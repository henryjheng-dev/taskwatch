import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { GenerateBoardDto } from './dto/generate-board.dto';
import type { AuthRequest } from '../auth/interface';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /ai/generate
   * 使用 Gemini 根據 prompt 生成看板結構並存入 DB。
   * 每人每日限 5 次（Redis 計數），超過回傳 429。
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generateBoard(@Body() dto: GenerateBoardDto, @Req() req: AuthRequest) {
    return this.aiService.generateBoard(dto, req.user.id);
  }

  /**
   * GET /ai/usage
   * 查詢今日 AI 使用次數及剩餘配額。
   */
  @Get('usage')
  getUsage(@Req() req: AuthRequest) {
    return this.aiService.getUsage(req.user.id);
  }
}
