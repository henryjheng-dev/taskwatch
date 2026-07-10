import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface HttpExceptionResponse {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

// PRD §3.2 錯誤碼對照表
const HTTP_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'INVALID_TRANSITION',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

function isHttpExceptionResponse(res: unknown): res is HttpExceptionResponse {
  return typeof res === 'object' && res !== null && 'message' in res;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal Server Error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HTTP_CODE_MAP[status] ?? 'HTTP_ERROR';

      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (isHttpExceptionResponse(res)) {
        message = res.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // PRD §3.3 統一錯誤格式
    response.status(status).json({
      success: false,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
