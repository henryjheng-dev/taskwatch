import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        // ── Application ──────────────────────────────────────────────
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        // 強制檢查 CORS 來源，避免跨域請求遭任意網站存取
        CORS_ORIGIN: Joi.string().uri().required(),

        // ── Database ────────────────────────────────────────────────
        DATABASE_URL: Joi.string().uri().required(),
        DB_HOST: Joi.string().required(),
        // TCP port 合法範圍 1~65535
        DB_PORT: Joi.number().integer().min(1).max(65535).required(),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        // 是否啟用 DB TLS 連線（'true'/'false'），生產環境建議設 'true'
        DB_SSL: Joi.string().valid('true', 'false').default('false'),

        // ── JWT ───────────────────────────────────────────────────
        // 亂碼：最少 32 字元 (256-bit等級的演算法)，防止暴力破解
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().required(),

        // ── Google OAuth ──────────────────────────────────────────
        // 身份識別碼，給 Google 確認請求是來自哪個網站
        GOOGLE_CLIENT_ID: Joi.string().required(),

        // ── Gemini AI ────────────────────────────────────────────
        GEMINI_API_KEY: Joi.string().required(),
        // Gemini API 限額 : 一個帳號先暫定每日 5 次
        AI_DAILY_LIMIT: Joi.number().integer().min(1).default(5),

        // ── Redis ─────────────────────────────────────────────────
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().port().default(6379),

        // ── Rate Limiting ─────────────────────────────────────────
        THROTTLE_TTL: Joi.number().integer().min(1).default(60),
        THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
      }),
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
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
