import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 封裝所有 RefreshToken 的 DB 操作。
 * AuthService 不直接碰 Prisma，改透過此 Repository。
 */
@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 將 Refresh Token 明文存入 DB。
   */
  async save(userId: number, rawToken: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: rawToken,
        expiresAt,
      },
    });
  }

  /**
   * 驗證 Refresh Token：存在、未被撤銷、未過期。
   * 同時取得 userId 供後續查詢使用。
   */
  async verify(
    rawToken: string,
  ): Promise<{ id: number; userId: number } | null> {
    const record = await this.prisma.refreshToken.findFirst({
      where: {
        token: rawToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });
    return record ?? null;
  }

  /**
   * 撤銷使用者所有 Token（登出時呼叫）。
   */
  async revokeAll(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
