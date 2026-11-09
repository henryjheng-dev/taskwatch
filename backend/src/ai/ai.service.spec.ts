import {
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AiService, parseDueDate } from './ai.service';

jest.mock(
  '@/generated/prisma/client',
  () => ({
    Priority: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
  }),
  { virtual: true },
);

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

jest.mock('@google/genai', () => {
  class GoogleGenAI {
    models = {
      generateContent: jest.fn(),
    };
  }

  return {
    GoogleGenAI,
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      ARRAY: 'ARRAY',
    },
  };
});

describe('parseDueDate', () => {
  it('undefined 回傳 null', () => {
    expect(parseDueDate(undefined)).toBeNull();
  });

  it('空字串回傳 null', () => {
    expect(parseDueDate('')).toBeNull();
  });

  it('合法日期字串轉成 Date', () => {
    expect(parseDueDate('2026-11-15')).toEqual(new Date('2026-11-15'));
  });

  it('非法日期字串回傳 null', () => {
    expect(parseDueDate('not-a-date')).toBeNull();
  });
});

describe('AiService', () => {
  let prisma: any;
  let tx: any;
  let redis: any;
  let configService: any;
  let service: AiService;
  let generateContent: jest.Mock;

  const usageKey = 'ai_usage:7';

  const validGeminiResponse = {
    text: JSON.stringify({
      boardName: 'Launch Plan',
      columns: [
        {
          name: '待辦',
          tasks: [
            {
              title: '撰寫規格',
              priority: 'high',
              dueDate: '2026-11-15',
            },
            {
              title: '建立 API',
              description: '實作端點',
              priority: 'low',
            },
          ],
        },
        {
          name: '完成',
          tasks: [],
        },
      ],
    }),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    tx = {
      board: {
        create: jest.fn().mockResolvedValue({ id: 50 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 50 }),
      },
      column: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 60 })
          .mockResolvedValueOnce({ id: 61 }),
      },
      task: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prisma = {
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    redis = {
      increment: jest.fn().mockResolvedValue(1),
      decrement: jest.fn().mockResolvedValue(0),
      ttl: jest.fn().mockResolvedValue(86400),
      get: jest.fn().mockResolvedValue(0),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue('test-api-key'),
      get: jest.fn().mockReturnValue(5),
    };

    service = new AiService(
      prisma as never,
      redis as never,
      configService as never,
    );
    generateContent = (service as any).genai.models.generateContent;
  });

  describe('constructor', () => {
    it('從 ConfigService 取得 API key 與每日上限', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith('GEMINI_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('AI_DAILY_LIMIT');
    });

    it('AI_DAILY_LIMIT 未設定時預設為 5', async () => {
      configService.get.mockReturnValue(undefined);
      const defaultService = new AiService(
        prisma as never,
        redis as never,
        configService as never,
      );
      redis.get.mockResolvedValue(0);
      redis.ttl.mockResolvedValue(-1);

      await expect(defaultService.getUsage(7)).resolves.toEqual({
        used: 0,
        remaining: 5,
        limit: 5,
        resetsIn: 0,
      });
    });
  });

  describe('generateBoard', () => {
    it('超過每日上限時回傳 429、退還額度且不呼叫 Gemini', async () => {
      redis.increment.mockResolvedValue(6);
      redis.ttl.mockResolvedValue(7200);

      let caught: unknown;
      try {
        await service.generateBoard({ prompt: '建立專案' }, 7);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(HttpException);
      expect((caught as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect((caught as HttpException).getResponse()).toContain('5 次');
      expect((caught as HttpException).getResponse()).toContain('2 小時後重置');
      expect(generateContent).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(redis.decrement).toHaveBeenCalledTimes(1);
      expect(redis.decrement).toHaveBeenCalledWith(usageKey);
    });

    it('次數剛好等於上限時仍允許生成', async () => {
      redis.increment.mockResolvedValue(5);
      generateContent.mockResolvedValue(validGeminiResponse);

      await expect(
        service.generateBoard({ prompt: '建立專案' }, 7),
      ).resolves.toEqual({ id: 50 });

      expect(redis.decrement).not.toHaveBeenCalled();
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it('成功時建立看板、欄位與任務並回傳完整看板', async () => {
      generateContent.mockResolvedValue(validGeminiResponse);

      await expect(
        service.generateBoard({ prompt: '建立專案' }, 7),
      ).resolves.toEqual({ id: 50 });

      expect(redis.increment).toHaveBeenCalledWith(usageKey, 86400);
      expect(generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: '建立專案',
          config: expect.objectContaining({
            responseMimeType: 'application/json',
          }),
        }),
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(tx.board.create).toHaveBeenCalledWith({
        data: {
          name: 'Launch Plan',
          ownerId: 7,
          boardMembers: {
            create: { userId: 7, role: 'ADMIN' },
          },
        },
      });
      expect(tx.column.create).toHaveBeenCalledWith({
        data: { name: '待辦', position: 0, boardId: 50 },
      });
      expect(tx.column.create).toHaveBeenCalledWith({
        data: { name: '完成', position: 1, boardId: 50 },
      });
      expect(tx.task.createMany).toHaveBeenCalledTimes(1);
      expect(tx.task.createMany).toHaveBeenCalledWith({
        data: [
          {
            title: '撰寫規格',
            description: null,
            priority: 'HIGH',
            dueDate: new Date('2026-11-15'),
            position: 0,
            columnId: 60,
            createdBy: 7,
          },
          {
            title: '建立 API',
            description: '實作端點',
            priority: 'LOW',
            dueDate: null,
            position: 1,
            columnId: 60,
            createdBy: 7,
          },
        ],
      });
      expect(tx.board.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 50 },
        include: {
          columns: {
            orderBy: { position: 'asc' },
            include: {
              tasks: { orderBy: { position: 'asc' } },
            },
          },
        },
      });
      expect(redis.decrement).not.toHaveBeenCalled();
    });

    it('欄位沒有任務時不呼叫 createMany', async () => {
      generateContent.mockResolvedValue({
        text: JSON.stringify({
          boardName: 'Empty',
          columns: [{ name: '待辦', tasks: [] }],
        }),
      });

      await service.generateBoard({ prompt: '建立空看板' }, 7);

      expect(tx.column.create).toHaveBeenCalledTimes(1);
      expect(tx.task.createMany).not.toHaveBeenCalled();
    });

    it('Gemini 呼叫失敗時退還額度並回傳 400', async () => {
      generateContent.mockRejectedValue(new Error('Gemini down'));

      await expect(
        service.generateBoard({ prompt: '建立專案' }, 7),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(redis.decrement).toHaveBeenCalledWith(usageKey);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Gemini 回傳空內容時退還額度並回傳 400', async () => {
      generateContent.mockResolvedValue({ text: '' });

      await expect(
        service.generateBoard({ prompt: '建立專案' }, 7),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(redis.decrement).toHaveBeenCalledWith(usageKey);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Gemini 回傳非法 JSON 時退還額度並回傳 400', async () => {
      generateContent.mockResolvedValue({ text: 'not json' });

      await expect(
        service.generateBoard({ prompt: '建立專案' }, 7),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(redis.decrement).toHaveBeenCalledWith(usageKey);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('DB 交易失敗時退還額度並回傳 400', async () => {
      generateContent.mockResolvedValue(validGeminiResponse);
      tx.board.findUniqueOrThrow.mockRejectedValue(new Error('db down'));

      await expect(
        service.generateBoard({ prompt: '建立專案' }, 7),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(redis.decrement).toHaveBeenCalledWith(usageKey);
    });

    it('自訂每日上限時使用設定的數值', async () => {
      configService.get.mockReturnValue(2);
      const limitedService = new AiService(
        prisma as never,
        redis as never,
        configService as never,
      );
      redis.increment.mockResolvedValue(3);
      redis.ttl.mockResolvedValue(3600);

      let caught: unknown;
      try {
        await limitedService.generateBoard({ prompt: '建立專案' }, 7);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(HttpException);
      expect((caught as HttpException).getResponse()).toContain('2 次');
      expect(redis.decrement).toHaveBeenCalledWith(usageKey);
    });
  });

  describe('getUsage', () => {
    it('已使用 3 次、上限 5 次時剩餘 2 次', async () => {
      redis.get.mockResolvedValue(3);
      redis.ttl.mockResolvedValue(3600);

      await expect(service.getUsage(7)).resolves.toEqual({
        used: 3,
        remaining: 2,
        limit: 5,
        resetsIn: 3600,
      });

      expect(redis.get).toHaveBeenCalledWith(usageKey);
      expect(redis.ttl).toHaveBeenCalledWith(usageKey);
    });

    it('已使用超過上限時剩餘次數為 0', async () => {
      redis.get.mockResolvedValue(8);
      redis.ttl.mockResolvedValue(1800);

      await expect(service.getUsage(7)).resolves.toEqual({
        used: 8,
        remaining: 0,
        limit: 5,
        resetsIn: 1800,
      });
    });

    it('沒有使用紀錄時 used 為 0、TTL 不存在時 resetsIn 為 0', async () => {
      redis.get.mockResolvedValue(0);
      redis.ttl.mockResolvedValue(-1);

      await expect(service.getUsage(7)).resolves.toEqual({
        used: 0,
        remaining: 5,
        limit: 5,
        resetsIn: 0,
      });
    });
  });
});
