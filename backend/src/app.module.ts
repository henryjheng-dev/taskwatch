import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { BoardsModule } from './boards/boards.module';
import { ColumnsModule } from './columns/columns.module';
import { TasksModule } from './tasks/tasks.module';
import { LabelsModule } from './labels/labels.module';
import { RedisModule } from './redis/redis.module';
import { REDIS_CLIENT } from './redis/redis.constants';
import { AiModule } from './ai/ai.module';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import type { Redis } from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        // 直接允許作業系統自帶的其他未知環境變數
        allowUnknown: true,
        // 一次列出所有缺失，方便除錯
        abortEarly: false,
      },
    }),
    PrismaModule,
    ThrottlerModule.forRootAsync({
      // ConfigModule 已是 isGlobal，不需要重複 imports
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (configService: ConfigService, redisClient: Redis) => ({
        throttlers: [
          {
            // THROTTLE_TTL 從 .env 讀取（秒） × 1000 = 毫秒
            ttl: configService.getOrThrow<number>('THROTTLE_TTL') * 1000,
            limit: configService.getOrThrow<number>('THROTTLE_LIMIT'),
            blockDuration:
              configService.getOrThrow<number>('THROTTLE_BLOCK_DURATION') *
              1000,
          },
        ],
        // 用 Redis 當限流 storage，確保多實例部署下計數共享、限流不失效
        storage: new RedisThrottlerStorage(redisClient),
      }),
    }),
    AuthModule,
    BoardsModule,
    ColumnsModule,
    TasksModule,
    LabelsModule,
    RedisModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
