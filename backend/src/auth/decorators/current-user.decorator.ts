// 這份文件是一個 NestJS 的自訂裝飾器，用來從經過 JWT 驗證的請求中提取當前使用者的資訊。它使用了 `createParamDecorator` 函數來創建一個新的參數裝飾器，並且在執行上下文中獲取 HTTP 請求對象，從中提取 `user` 屬性，這個屬性應該包含了經過驗證的使用者資訊。這樣在控制器方法中就可以直接使用 `@CurrentUser()` 來獲取當前使用者的資訊，非常方便。

// createParamDecorator 是 NestJS 提供的一個函數，用來創建自訂的參數裝飾器。它接受一個函數作為參數，這個函數會在執行上下文中被調用，並且可以從中獲取請求對象、響應對象等資訊。在這裡，我們從請求對象中提取了 `user` 屬性，這個屬性應該是在 JWT 驗證過程中被設置的，包含了當前使用者的資訊。它的用法是在控制器方法的參數上使用 `@CurrentUser()`，這樣就可以直接獲取當前使用者的資訊，而不需要在每個方法中重複從請求對象中提取。

//ExecutionContext 是 NestJS 中的一個接口，代表了當前的執行上下文。它提供了一些方法來獲取不同類型的上下文，例如 HTTP、WebSocket、RPC 等。在這裡，我們使用 `switchToHttp()` 方法來獲取 HTTP 上下文，然後使用 `getRequest()` 方法來獲取 HTTP 請求對象。這樣我們就可以從請求對象中提取 `user` 屬性，這個屬性應該包含了經過 JWT 驗證的使用者資訊。他的用法是在控制器方法的參數上使用 `@CurrentUser()`，這樣就可以直接獲取當前使用者的資訊，而不需要在每個方法中重複從請求對象中提取。
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
