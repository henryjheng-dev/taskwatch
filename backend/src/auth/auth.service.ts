import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuthProvider, Prisma } from '@/generated/prisma/client';

/** bcrypt 雜湊強度 */
const BCRYPT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * 將 "15m", "7d" 等 duration 字串轉換為未來的 Date 物件。
 * 目的：計算 RefreshToken 的 expiresAt 欄位存入 DB。
 */
function toExpiresAt(duration: string): Date {
  const units: Record<string, number> = {
    s: 1_000,
    m: 60 * 1_000,
    h: 60 * 60 * 1_000,
    d: 24 * 60 * 60 * 1_000,
  };
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`時間格式錯誤: "${duration}"`);
  return new Date(Date.now() + parseInt(match[1], 10) * units[match[2]]);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 用 Email + 密碼 建立帳號。
   * 若 Email 已存在拋 ConflictException（409），
   * 成功後立即回傳第一組 token pair（免除二次登入）。
   */
  async register(dto: RegisterDto): Promise<TokenPair> {
    try {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash: passwordHash,
          authProvider: AuthProvider.EMAIL,
        },
        select: { id: true, email: true },
      });
      return this.generateTokens(user.id, user.email);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('此 Email 已被註冊');
      }
      throw error;
    }
  }

  /**
   * 用 Email + 密碼 登入。
   * 刻意使用相同錯誤訊息（帳號或密碼錯誤）防止 User Enumeration 攻擊。
   */
  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (
      !user ||
      user.authProvider !== AuthProvider.EMAIL ||
      !user.passwordHash
    ) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    return this.generateTokens(user.id, user.email);
  }

  /**
   * 用舊的 Refresh Token 換一組新的 Token Pair（Rotation 機制）。
   * 收到請求後立即 revoke 舊 token，避免 replay 攻擊。
   */
  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token 無效或已過期');
    }

    // 先 revoke 舊 token（Token Rotation）
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
    });

    return this.generateTokens(user.id, user.email);
  }

  /**
   * 登出：revoke 該使用者所有尚未撤銷的 Refresh Token。
   * 確保所有裝置同步登出（single-user logout）。
   */
  async logout(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Google OAuth callback 時呼叫。
   * 若 Email 已存在但尚未綁定 googleId，則補綁；
   * 若完全不存在，則自動建立 Google 帳號。
   */
  async validateGoogleUser(
    googleId: string,
    email: string,
    name: string,
  ): Promise<{ id: number; email: string }> {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: { name, email, googleId, authProvider: AuthProvider.GOOGLE },
      });
    } else if (!user.googleId) {
      // Email 帳號首次使用 Google 登入，補綁 googleId
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    return { id: user.id, email: user.email };
  }

  /**
   * Google OAuth callback 專用：validateGoogleUser 確認身份後，
   * 由 Controller 呼叫此方法取得 token pair。
   * 獨立對外公開以避免 Controller 直接存取私有方法。
   */
  issueTokensForUser(userId: number, email: string): Promise<TokenPair> {
    return this.generateTokens(userId, email);
  }

  // ──────────────────────────── Private ────────────────────────────

  /**
   * 產生 Access Token + Refresh Token。
   *
   * - Access Token：JWT，帶 sub/email，短效（15m）
   * - Refresh Token：random 40-byte hex 明文回傳給 client，
   *   SHA-256 hash 存入 DB（不存明文，防資料庫洩漏）
   */
  private async generateTokens(
    userId: number,
    email: string,
  ): Promise<TokenPair> {
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const jwtExpiresIn =
      this.configService.getOrThrow<string>('JWT_EXPIRES_IN');
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    const payload: JwtPayload = { sub: userId, email };
    const rawRefreshToken = randomBytes(40).toString('hex');

    const signOptions = { secret: jwtSecret, expiresIn: jwtExpiresIn };
    const accessToken = await this.jwtService.signAsync(
      payload,
      // expiresIn 的 StringValue 型別來自 ms 套件；透過中間變數繞過型別限制
      signOptions as Parameters<typeof this.jwtService.signAsync>[1],
    );

    // refresh token 不用 JWT，只是隨機亂數；expiry 由 DB 管理
    void refreshSecret; // reserved for future refresh-token JWT signing if needed

    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: toExpiresAt(refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
