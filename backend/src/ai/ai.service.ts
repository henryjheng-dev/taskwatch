import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Priority } from '@/generated/prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GenerateBoardDto } from './dto/generate-board.dto';

/** Redis Key 格式：ai_usage:{userId} */
const aiUsageKey = (userId: number) => `ai_usage:${userId}`;
/** TTL = 24 小時 */
const SECONDS_IN_A_DAY = 24 * 60 * 60;

/**
 * Gemini 預期回傳的 JSON 結構（型別定義）
 * 對應 PRD §7.2 回應格式規格
 */
interface GeminiColumn {
  name: string;
  tasks: {
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
  }[];
}

interface GeminiBoardSchema {
  boardName: string;
  columns: GeminiColumn[];
}

/**
 * 對應 GeminiBoardSchema 的 JSON Schema。
 * 交給 generateContent 的 responseSchema，讓 Gemini「強制」輸出符合此結構的 JSON。
 */
const boardResponseSchema = {
  type: Type.OBJECT,
  properties: {
    boardName: {
      type: Type.STRING,
      description: '看板名稱',
    },
    columns: {
      type: Type.ARRAY,
      description:
        '最多 5 個欄位，欄位名稱應反映工作流程狀態（例如：待辦、進行中、完成）',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: '欄位名稱' },
          tasks: {
            type: Type.ARRAY,
            description: '每個欄位最多 5 個任務',
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: '任務標題' },
                description: {
                  type: Type.STRING,
                  description: '任務描述（可選）',
                  nullable: true,
                },
                priority: {
                  type: Type.STRING,
                  enum: ['low', 'medium', 'high'],
                  description: '任務優先級',
                },
                dueDate: {
                  type: Type.STRING,
                  description: '截止日期（YYYY-MM-DD 格式，可選）',
                  nullable: true,
                },
              },
              required: ['title', 'priority'],
            },
          },
        },
        required: ['name', 'tasks'],
      },
    },
  },
  required: ['boardName', 'columns'],
};

/**
 * 將 Gemini 回傳的日期字串轉為 Date。
 * 沒有值或非法日期一律回傳 null（不寫入「今天」，也不讓 Invalid Date 炸掉交易）。
 */
export function parseDueDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genai: GoogleGenAI;
  private readonly aiDailyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.genai = new GoogleGenAI({ apiKey });
    this.aiDailyLimit = this.configService.get<number>('AI_DAILY_LIMIT') ?? 5;
  }

  /**
   * POST /ai/generate
   * 根據使用者描述，用 Gemini 生成看板結構，並批次寫入 DB。
   * 每日限額（Redis 計數）。
   *
   * @returns 建立好的 Board 及其所有 Columns + Tasks
   */
  async generateBoard(dto: GenerateBoardDto, userId: number) {
    // ── 1. 先 INCR，再 check（原子操作，無 race condition）──────
    const usageKey = aiUsageKey(userId);
    const count = await this.redis.increment(usageKey, SECONDS_IN_A_DAY);
    if (count > this.aiDailyLimit) {
      const ttl = await this.redis.ttl(usageKey);
      throw new HttpException(
        `今日 AI 生成次數已達上限（${this.aiDailyLimit} 次），${Math.ceil(ttl / 3600)} 小時後重置`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── 2. Gemini 呼叫 + DB 寫入：任一失敗都退還額度 ──
    try {
      const parsedBoard = await this.callGemini(dto.prompt);
      return await this.persistBoard(parsedBoard, userId);
    } catch (error) {
      this.logger.error('AI 生成失敗', error);
      // 涵蓋 Gemini 失敗與 DB 交易失敗兩種情境，避免使用者因系統錯誤白白扣掉次數
      await this.redis.decrement(usageKey);
      throw new BadRequestException('AI 生成失敗，請重新嘗試或修改描述');
    }
  }

  /**
   * 呼叫 Gemini（結構化輸出），回傳解析後的看板結構。
   */
  private async callGemini(prompt: string): Promise<GeminiBoardSchema> {
    const systemPrompt = `你是一個專案管理助手。使用者會描述一個專案，你需要為其生成看板結構。
規則：
- 最多 5 個欄位
- 每個欄位最多 5 個任務
- 使用繁體中文回應（若使用者用英文輸入則用英文）
- 欄位名稱應反映工作流程狀態（例如：待辦、進行中、完成）
- 若使用者有提到時程或截止日期，請為相關任務加上 dueDate（格式 YYYY-MM-DD）`;

    const response = await this.genai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: boardResponseSchema,
        temperature: 1,
        maxOutputTokens: 65536,
        topP: 0.95,
      },
    });

    const raw = response.text;
    if (!raw) {
      throw new Error('Gemini 回傳內容為空');
    }
    // responseSchema 已保證輸出是符合結構的 JSON，不需要再處理 markdown code fence
    return JSON.parse(raw) as GeminiBoardSchema;
  }

  /**
   * Prisma Transaction：批次建立 Board + Columns + Tasks。
   * 任一 INSERT 失敗會整筆回滾。
   */
  private async persistBoard(parsedBoard: GeminiBoardSchema, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const createdBoard = await tx.board.create({
        data: {
          name: parsedBoard.boardName,
          ownerId: userId,
          boardMembers: {
            create: { userId, role: 'ADMIN' },
          },
        },
      });

      for (
        let colIndex = 0;
        colIndex < parsedBoard.columns.length;
        colIndex++
      ) {
        const col = parsedBoard.columns[colIndex];
        const createdCol = await tx.column.create({
          data: {
            name: col.name,
            position: colIndex,
            boardId: createdBoard.id,
          },
        });

        if (col.tasks && col.tasks.length > 0) {
          await tx.task.createMany({
            data: col.tasks.map((task, taskIndex) => ({
              title: task.title,
              description: task.description ?? null,
              priority: task.priority.toUpperCase() as Priority,
              dueDate: parseDueDate(task.dueDate),
              position: taskIndex,
              columnId: createdCol.id,
              createdBy: userId,
            })),
          });
        }
      }

      // 回傳完整的 board 含 columns + tasks
      return tx.board.findUniqueOrThrow({
        where: { id: createdBoard.id },
        include: {
          columns: {
            orderBy: { position: 'asc' },
            include: {
              tasks: { orderBy: { position: 'asc' } },
            },
          },
        },
      });
    });
  }

  /**
   * GET /ai/usage
   * 查詢今日已使用次數及剩餘次數。
   */
  async getUsage(userId: number) {
    const usageKey = aiUsageKey(userId);
    const used = await this.redis.get(usageKey);
    const ttl = await this.redis.ttl(usageKey);

    return {
      used,
      remaining: Math.max(0, this.aiDailyLimit - used),
      limit: this.aiDailyLimit,
      resetsIn: ttl > 0 ? ttl : 0,
    };
  }
}
