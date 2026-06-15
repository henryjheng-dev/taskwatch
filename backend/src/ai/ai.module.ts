import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

/**
 * AiModule 依賴：
 * - PrismaModule（@Global，自動可用）
 * - RedisModule（@Global，自動可用）
 * - ConfigModule（@Global，自動可用）
 */
@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
