import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

// PRD §3.3 統一成功 Response 格式
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  { success: true; data: T; statusCode: number }
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ success: true; data: T; statusCode: number }> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data: T) => ({
        success: true as const,
        data,
        statusCode,
      })),
    );
  }
}
