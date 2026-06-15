import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../strategies/jwt.strategy';

/**
 * 從 JWT 驗證後的 req.user 取出當前使用者。
 * 用法：@CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
