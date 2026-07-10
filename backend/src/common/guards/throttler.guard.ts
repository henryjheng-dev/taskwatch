import { Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

/**
 * 自訂 ThrottlerGuard，覆寫錯誤訊息為中文。
 * 與 HttpExceptionFilter 整合：429 → RATE_LIMITED
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('請求過於頻繁，請稍後再試');
  }
}
