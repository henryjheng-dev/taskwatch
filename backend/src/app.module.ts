import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BoardsModule } from './boards/boards.module';
import { ColumnsModule } from './columns/columns.module';
import { TasksModule } from './tasks/tasks.module';
import { LabelsModule } from './labels/labels.module';
import Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        // ── 應用程式 ──────────────────────────────────────────────
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        CORS_ORIGIN: Joi.string().uri().required(),

        // ── 資料庫 ────────────────────────────────────────────────
        DATABASE_URL: Joi.string().uri().required(),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().integer().min(1).max(65535).required(),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),

        // ── JWT ───────────────────────────────────────────────────
        // min(32) = 256-bit 最低安全長度，符合 OWASP JWT Cheat Sheet
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().required(),

        // ── Google OAuth ──────────────────────────────────────────
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().uri().required(),

        // ── Redis ─────────────────────────────────────────────────
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().port().default(6379),

        // ── Rate Limiting ─────────────────────────────────────────
        // THROTTLE_TTL 單位為秒（seconds），程式內轉換為 ms
        THROTTLE_TTL: Joi.number().integer().min(1).default(60),
        THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
      }),
      validationOptions: {
        // 允許 OS 層級的其他環境變數（PATH、HOME 等）通過驗證
        allowUnknown: true,
        // abortEarly: false → 一次性列出所有缺失的變數，方便除錯
        abortEarly: false,
      },
    }),
    PrismaModule,
    ThrottlerModule.forRootAsync({
      // ConfigModule 已是 isGlobal，不需要重複 imports
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            // THROTTLE_TTL 從 .env 讀取（秒） × 1000 = 毫秒
            ttl: configService.getOrThrow<number>('THROTTLE_TTL') * 1000,
            limit: configService.getOrThrow<number>('THROTTLE_LIMIT'),
          },
        ],
      }),
    }),
    AuthModule,
    BoardsModule,
    ColumnsModule,
    TasksModule,
    LabelsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
