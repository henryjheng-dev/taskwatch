import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import ms, { type StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OAuth2Client } from 'google-auth-library';
import { JwtPayload } from './strategies/jwt.strategy';
import type { TokenPair, LoginResponse } from './interface';
import { AuthProvider, Prisma } from '@/generated/prisma/client';

/** bcrypt 雜湊強度 */
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokensRepo: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 用 Email + 密碼 建立帳號。
   * 若 Email 已存在拋 ConflictException（409），
   * 成功後立即回傳第一組 token pair（免除二次登入）。
   */
  async register(dto: RegisterDto): Promise<LoginResponse> {
    try {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          authProvider: AuthProvider.EMAIL,
        },
        select: { id: true, name: true, email: true },
      });
      const tokens = await this.generateTokens(user.id, user.email);
      return { ...tokens, user };
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
   * 刻意使用相同錯誤訊息防止 User Enumeration 攻擊。
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        authProvider: true,
      },
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

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  /**
   * 用 Refresh Token 換新的 Token Pair。
   * 驗證有效性後直接簽發新 token pair。
   */
  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    const valid = await this.refreshTokensRepo.verify(rawRefreshToken);

    if (!valid) {
      throw new UnauthorizedException('Refresh Token 無效或已過期');
    }

    // 撤銷舊 token，簽發新 token
    await this.refreshTokensRepo.revokeAll(valid.userId);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: valid.userId },
      select: { id: true, email: true },
    });

    return this.generateTokens(user.id, user.email);
  }

  /**
   * 登出：revoke 該使用者所有尚未撤銷的 Refresh Token。
   */
  async logout(userId: number): Promise<void> {
    await this.refreshTokensRepo.revokeAll(userId);
  }

  /**
   * Google OAuth callback 時呼叫。
   * 若 Email 已存在且為 EMAIL 登入方式，拋出明確錯誤；
   * 若已存在 Google 帳號則直接回傳；
   * 若不存在則自動建立。
   */
  async validateGoogleUser(
    googleId: string,
    email: string,
    name: string,
  ): Promise<{ id: number; email: string }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, authProvider: true, googleId: true },
    });

    if (existingUser) {
      if (existingUser.authProvider === AuthProvider.EMAIL) {
        throw new UnauthorizedException(
          '此 Email 已用密碼方式註冊，請改用 Email 登入',
        );
      }
      // 已存在 Google 帳號
      if (!existingUser.googleId) {
        return this.prisma.user.update({
          where: { id: existingUser.id },
          data: { googleId },
          select: { id: true, email: true },
        });
      }
      return { id: existingUser.id, email: existingUser.email };
    }

    // 不存在 → 建立新帳號
    const user = await this.prisma.user.create({
      data: { name, email, googleId, authProvider: AuthProvider.GOOGLE },
      select: { id: true, email: true },
    });

    return user;
  }

  /**
   * Google OAuth callback 專用：確認身份後由 Controller 呼叫取得 token pair。
   */
  issueTokensForUser(userId: number, email: string): Promise<TokenPair> {
    return this.generateTokens(userId, email);
  }

  // ──────────────────────────── Private ────────────────────────────

  /**
   * 產生 Access Token + Refresh Token。
   *
   * - Access Token：JWT，帶 sub/email，短效
   * - Refresh Token：random 40-byte hex，明文存入 DB
   */
  private async generateTokens(
    userId: number,
    email: string,
  ): Promise<TokenPair> {
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const jwtExpiresIn =
      this.configService.getOrThrow<StringValue>('JWT_EXPIRES_IN');
    const refreshExpiresIn = this.configService.getOrThrow<StringValue>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    const payload: JwtPayload = { sub: userId, email };
    const rawRefreshToken = randomBytes(40).toString('hex');

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
    });

    await this.refreshTokensRepo.save(
      userId,
      rawRefreshToken,
      new Date(Date.now() + ms(refreshExpiresIn)),
    );

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
