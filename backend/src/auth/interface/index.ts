import type { Request } from 'express';
import type { AuthUser } from '../strategies/jwt.strategy';

/** 帶有 JWT 驗證後 user 資訊的 Request */
export interface AuthRequest extends Request {
  user: AuthUser;
  cookies: {
    refresh_token?: string;
    [key: string]: string | undefined;
  };
}

/** 登入成功回傳格式 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

/** Token Rotation 回傳格式 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** 內部 Token Pair（不對外暴露 user） */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
