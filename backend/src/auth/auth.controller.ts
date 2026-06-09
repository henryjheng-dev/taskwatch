import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthUser } from './strategies/jwt.strategy';

/** req.user 在通過 JwtAuthGuard 或 Google Guard 後的型別 */
type AuthRequest = Request & { user: AuthUser };

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
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(this.isProduction));
    return { accessToken };
  }

  /**
   * POST /auth/login
   * Email + 密碼 登入，回傳 accessToken；refresh token 寫入 Cookie。
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(this.isProduction));
    return { accessToken };
  }

  /**
   * POST /auth/refresh
   * 用 httpOnly Cookie 裡的 refresh token 換新的 token pair（Token Rotation）。
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
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  /**
   * GET /auth/google
   * Passport 攔截後自動 redirect 到 Google 授權頁，方法本身無需內容。
   */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirect，此處無需實作
  }

  /**
   * GET /auth/google/callback
   * Google 授權完成後回到此 endpoint。
   * GoogleStrategy.validate() 已建立/取得 user，結果掛在 req.user。
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @HttpCode(HttpStatus.OK)
  async googleCallback(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.issueTokensForUser(req.user.id, req.user.email);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(this.isProduction));
    return { accessToken };
  }
}
