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

const REFRESH_COOKIE = 'refresh_token';

/** Cookie 設定 */
const cookieOptions = (secureProd: boolean) => ({
  // 防範 XSS 攻擊：禁止前端 JS 存取，防止惡意腳本偷取 Token
  httpOnly: true,
  // 防範 CSRF 攻擊：限制僅同源請求可帶入 Cookie，避免釣魚網站偽造請求
  sameSite: 'strict' as const,
  // 防禦中間人竊聽：生產環境強制僅允許 HTTPS 加密傳輸
  secure: secureProd,
  // 作用域限制：設定為 '/' 代表全站所有 API 路徑發送請求時皆會自動附帶此 Cookie
  path: '/',
  // 生命週期設定：單位毫秒 (ms)，設定 7 天後自動失效並被瀏覽器清除
  maxAge: 7 * 24 * 60 * 60 * 1000,
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
