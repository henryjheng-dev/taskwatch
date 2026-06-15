import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GenerateBoardDto } from './dto/generate-board.dto';

/** 每位使用者每日最多使用次數（PRD §7） */
const AI_DAILY_LIMIT = 5;
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
  tasks: { title: string; description?: string }[];
}

interface GeminiBoardSchema {
  boardName: string;
  columns: GeminiColumn[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genai: GoogleGenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.genai = new GoogleGenAI({ apiKey });
  }

  /**
   * POST /ai/generate
   * 根據使用者描述，用 Gemini 生成看板結構，並批次寫入 DB。
   * 每日限額 5 次（Redis 計數）。
   *
   * @returns 建立好的 Board 及其所有 Columns + Tasks
   */
  async generateBoard(dto: GenerateBoardDto, userId: number) {
    // ── 1. 確認每日限額 ──────────────────────────────────────────
    const usageKey = aiUsageKey(userId);
    const used = await this.redis.get(usageKey);
    if (used >= AI_DAILY_LIMIT) {
      throw new HttpException(
        `今日 AI 生成次數已達上限（${AI_DAILY_LIMIT} 次），請明日再試`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── 2. 呼叫 Gemini API ───────────────────────────────────────
    const systemPrompt = `你是一個專案管理助手。使用者會描述一個專案，你需要為其生成看板結構。
請只回傳 JSON，不要有其他文字，格式如下：
{
  "boardName": "看板名稱",
  "columns": [
    {
      "name": "欄位名稱",
      "tasks": [
        { "title": "任務標題", "description": "任務描述（可選）" }
      ]
    }
  ]
}
規則：
- 最多 5 個欄位
- 每個欄位最多 5 個任務
- 使用繁體中文回應（若使用者用英文輸入則用英文）
- 欄位名稱應反映工作流程狀態（例如：待辦、進行中、完成）`;

    let parsedBoard: GeminiBoardSchema;
    try {
      const response = await this.genai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n使用者需求：${dto.prompt}` }],
          },
        ],
      });
      const raw = response.text ?? '';
      // 移除可能的 markdown code block
      const cleaned = raw
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '')
        .trim();
      parsedBoard = JSON.parse(cleaned) as GeminiBoardSchema;
    } catch (error) {
      this.logger.error('Gemini API 呼叫失敗或 JSON 解析失敗', error);
      throw new BadRequestException('AI 生成失敗，請重新嘗試或修改描述');
    }

    // ── 3. Prisma Transaction：批次建立 Board + Columns + Tasks ──
    const board = await this.prisma.$transaction(async (tx) => {
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

    // ── 4. 遞增使用次數（Transaction 成功後才計數）──────────────
    await this.redis.increment(usageKey, SECONDS_IN_A_DAY);

    return board;
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
      remaining: Math.max(0, AI_DAILY_LIMIT - used),
      limit: AI_DAILY_LIMIT,
      resetsIn: ttl > 0 ? ttl : 0,
    };
  }
}
