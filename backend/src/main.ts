import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── 安全性 ────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cookieParser()); // Refresh Token HttpOnly Cookie 解析
  app.use(compression()); // gzip 壓縮回應

  // ── CORS ──────────────────────────────────────────────────────────
  // CORS_ORIGIN 從 .env 讀取，production 只允許 GitHub Pages
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true, // 允許 Cookie 跨域傳送
  });

  // ── Validation ────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true, // 讓 @Query() number 自動轉型
      },
    }),
  );

  // ── 全域 Filter / Interceptors ────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  // ── Swagger ────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TaskWatch API')
    .setDescription('KanbanFlow 任務管理系統 REST API 文件')
    .setVersion('1.0')
    .addBearerAuth() // 在 Swagger UI 中可以貼 JWT 測試
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document); // 訪問 /api/docs 查看文件

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
