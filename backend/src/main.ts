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

  // ── Security ────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cookieParser());
  app.use(compression());

  // ── CORS ──────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    // 允許前端在跨域請求時攜帶 Cookie 與 Authorization Headers
    credentials: true,
  });

  // ── Validation ────────────────────────────────────────────────────
  // ValidationPipe：對所有傳入 Controller 的 DTO 進行型別檢查與過濾
  app.useGlobalPipes(
    new ValidationPipe({
      // 只保留帶有 class-validator 裝飾器的屬性，其餘視為未知欄位
      whitelist: true,
      // 搭配 whitelist：遇到未知欄位時直接回 400
      forbidNonWhitelisted: true,
      // 將請求中的 plain object 轉成 DTO 類別實例，讓類別方法與裝飾器行為生效
      transform: true,
      transformOptions: {
        // 依 DTO 型別轉換 query/param 的字串
        enableImplicitConversion: true,
      },
    }),
  );

  // ── 全域 Filter / Interceptors ────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    // 統一包裝成功回應的資料格式
    new TransformInterceptor(),
    // 記錄請求資訊與處理耗時
    new LoggingInterceptor(),
  );

  // ── Swagger ────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TaskWatch API')
    .setDescription('TaskWatch 專案管理系統 REST API 文件')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
