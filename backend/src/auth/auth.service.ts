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

/** bcrypt 雜湊強度 */
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokensRepo: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly googleClient: OAuth2Client,
  ) {}

  /**
   * 註冊新帳號，並回傳 Token Pair。
   * 若 Email 已被註冊，會丟出 ConflictException。
   * 用passwordHash存密碼，避免明文存入 DB。
   * authProvider 設為 EMAIL，表示此帳號是用 Email/密碼方式註冊的。
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
   * user 是透過prisma查詢出來的資料，是關於使用者的資訊，包含id、name、email、passwordHash、authProvider等欄位。
   * 這個 if 判斷的目的是檢查使用者是否存在、是否使用 EMAIL 作為認證提供者，以及是否有設定密碼。
   * 具體來說：
   * - !user：如果 user 為 null 或 undefined，表示找不到該使用者。
   * - user.authProvider !== AuthProvider.EMAIL：如果使用者的認證提供者不是 EMAIL，表示該使用者可能是透過其他方式（例如 Google）註冊的。
   * - !user.passwordHash：如果使用者沒有設定密碼，表示該使用者無法透過密碼登入。
   * 如果以上三個條件其中之一成立，就會丟出 UnauthorizedException('帳號或密碼錯誤')，表示登入失敗。
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
   * refresh token 是用來換取新的 access token 的，當 access token 過期時，可以使用 refresh token 來獲取新的 access token，而不需要重新登入。
   * refresh token 的有效期通常比 access token 長，並且應該被安全地存儲（例如 httpOnly cookie），以防止被竊取。
   * revoked 是一個物件，包含了被撤銷的 refresh token 的 id 和對應的 userId，如果該 token 不存在或已被撤銷，則為 null。
   * revokeOne 方法會嘗試撤銷傳入的 refresh token，如果成功，表示該 token 是有效的；如果失敗，表示該 token 不存在、已過期或已被撤銷。
   * refreshTokensRepo 是一個用來操作 refresh token 的資料庫存取物件，它提供了 save、verify、revokeOne、revokeAll、findRevoked 等方法。
   * 這個方法的流程如下：
   * 1. 先嘗試撤銷傳入的 refresh token，如果成功，表示該 token 是有效的。
   * 2. 如果撤銷失敗，表示該 token 不存在、已過期或已被撤銷，這時會檢查該 token 是否曾經被撤銷過，如果是，表示可能是重複使用或 token 失竊，會強制全登出。
   * 3. 如果撤銷成功，就會查詢該 token 對應的使用者資訊，並生成新的 token pair（access token 和 refresh token）。
   * 4. 最後回傳新的 token pair。
   * @param rawRefreshToken 從 httpOnly cookie 中取得的 refresh token
   * @returns 新的 access token 和 refresh token
   * @throws UnauthorizedException 如果 refresh token 無效或已過期
   */
  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    const revoked = await this.refreshTokensRepo.revokeOne(rawRefreshToken);

    if (!revoked) {
      // token 不存在、已過期，或已被撤銷
      // 若是已撤銷 → 可能是重複使用或 token 失竊 → 強制全登出
      const reused = await this.refreshTokensRepo.findRevoked(rawRefreshToken);
      if (reused) {
        await this.refreshTokensRepo.revokeAll(reused.userId);
      }
      throw new UnauthorizedException('Refresh Token 無效或已過期');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: revoked.userId },
      select: { id: true, email: true },
    });

    return this.generateTokens(user.id, user.email);
  }

  async logout(userId: number): Promise<void> {
    await this.refreshTokensRepo.revokeAll(userId);
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

  // ──────────────────────────── Private ────────────────────────────

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
