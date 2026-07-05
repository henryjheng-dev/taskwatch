import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthUser } from './strategies/jwt.strategy';
import { CurrentUser } from './decorators/current-user.decorator';

// 登入端點專屬速率限制：10 次 / 15 分鐘（防暴力破解）
const LOGIN_THROTTLE_TTL = 15 * 60 * 1000;
const LOGIN_THROTTLE_LIMIT = 10;

/**
 * Refresh token 存放在 httpOnly Cookie，名稱一致避免手誤。
 * httpOnly = 前端 JS 無法讀取，防 XSS 竊取。
 */
const REFRESH_COOKIE = 'refresh_token';

/** Cookie 設定集中管理，方便日後調整 */
const cookieOptions = (secureProd: boolean) => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: secureProd,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天，與 JWT_REFRESH_EXPIRES_IN 一致
});

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(private readonly authService: AuthService) {
    this.isProduction = process.env['NODE_ENV'] === 'production';
  }

  /**
   * POST /auth/register
   * 建立新帳號，成功後直接回傳 accessToken（免二次登入）。
   * Refresh token 寫入 httpOnly Cookie。
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    // passthrough: true 讓 NestJS 不自動送出 response，方便我們在同一個 endpoint 設定 Cookie 後再送出 response。
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.register(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(this.isProduction));
    return { accessToken, user };
  }

  /**
   * POST /auth/login
   * Email + 密碼 登入，回傳 accessToken + user 資訊；refresh token 寫入 Cookie。
   * 獨立的 Throttle 設定：10 次 / 15 分鐘，防暴力破解。
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: { ttl: LOGIN_THROTTLE_TTL, limit: LOGIN_THROTTLE_LIMIT },
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(this.isProduction));
    return { accessToken, user };
  }

  /**
   * POST /auth/refresh
   * 用 httpOnly Cookie 裡的 refresh token 換新的 token pair。
   * 不需要 JWT Guard，因為 access token 此時已過期。
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw: unknown = (req.cookies as Record<string, string>)[
      REFRESH_COOKIE
    ];
    if (typeof raw !== 'string' || !raw) {
      throw new UnauthorizedException('Refresh token 不存在');
    }

    const { accessToken, refreshToken } =
      await this.authService.refreshTokens(raw);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(this.isProduction));
    return { accessToken };
  }

  /**
   * POST /auth/logout
   * 需要有效的 access token（JwtAuthGuard）。
   * 撤銷該 user 所有 refresh token 並清除 Cookie。
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  // 新增 @Post('google')

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.googleLogin(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(this.isProduction));
    return { accessToken, user };
  }
}
