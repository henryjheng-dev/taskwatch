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
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import type { TokenPair, LoginResponse } from './interface';
import { AuthProvider, Prisma } from '@/generated/prisma/client';

const BCRYPT_ROUNDS = 12;

// 輪替後的舊 refresh token 在此期間內重送，視為分頁競態或網路重試，不撤銷整個 session
const REFRESH_ROTATION_GRACE_MS = 10_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokensRepo: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly googleClient: OAuth2Client,
  ) {}

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

  async refreshTokens(rawRefreshToken: string): Promise<LoginResponse> {
    // 1. 正常輪替：舊 token 標記 revokedAt，發一組新的
    const rotated = await this.refreshTokensRepo.revokeOne(rawRefreshToken);
    if (rotated) {
      return this.buildLoginResponse(rotated.userId);
    }

    // 2. 找不到可輪替的 token，確認它是「剛被輪替」還是「無效/已過期」
    const existing = await this.refreshTokensRepo.findOne(rawRefreshToken);

    if (!existing || existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh Token 無效或已過期');
    }

    const withinGrace =
      existing.revokedAt !== null &&
      Date.now() - existing.revokedAt.getTime() <= REFRESH_ROTATION_GRACE_MS;

    // 3. 寬限期內：分頁競態或重試，直接再發一組
    if (withinGrace) {
      return this.buildLoginResponse(existing.userId);
    }

    // 4. 超過寬限期：視為 token 重複使用，刪除該使用者所有 session
    await this.refreshTokensRepo.deleteAllForUser(existing.userId);
    throw new UnauthorizedException('Refresh Token 無效或已過期');
  }

  async logout(userId: number): Promise<void> {
    await this.refreshTokensRepo.deleteAllForUser(userId);
  }

  async googleLogin(dto: GoogleLoginDto): Promise<LoginResponse> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');

    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new UnauthorizedException('Google 驗證失敗：無法取得 Email');
    }

    const { sub: googleId, email, name } = payload;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        authProvider: true,
        googleId: true,
      },
    });

    if (existingUser) {
      if (existingUser.authProvider === AuthProvider.EMAIL) {
        throw new UnauthorizedException(
          '此 Email 已用密碼方式註冊，請改用 Email 登入',
        );
      }

      if (!existingUser.googleId) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { googleId },
        });
      }

      const tokens = await this.generateTokens(
        existingUser.id,
        existingUser.email,
      );
      return {
        ...tokens,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
        },
      };
    }

    const user = await this.prisma.user.create({
      data: {
        name: name ?? '',
        email,
        googleId,
        authProvider: AuthProvider.GOOGLE,
      },
      select: { id: true, name: true, email: true },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    return { ...tokens, user };
  }

  private async buildLoginResponse(userId: number): Promise<LoginResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    return { ...tokens, user };
  }

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
