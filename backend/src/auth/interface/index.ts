import type { Request } from 'express';
import type { AuthUser } from '../strategies/jwt.strategy';

export interface AuthRequest extends Request {
  user: AuthUser;
  cookies: {
    refresh_token?: string;
    [key: string]: string | undefined;
  };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
