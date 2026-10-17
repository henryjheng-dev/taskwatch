import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const hashToken = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex');

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: number, rawToken: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    });
  }

  async revokeOne(rawToken: string): Promise<{ userId: number } | null> {
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(rawToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });
    /**
     * count === 0 代表 mysql 沒有任何資料被更新，可能是因為token不存在、已過期或已被撤銷。
     */
    if (result.count === 0) {
      return null;
    }

    // 取得 userId 供後續使用
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(rawToken) },
      select: { userId: true },
    });

    return record ?? null;
  }

  /**
   * 檢查 token 是否曾存在但已被撤銷（用於偵測重複使用）
   */
  async findRevoked(rawToken: string): Promise<{ userId: number } | null> {
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(rawToken), revokedAt: { not: null } },
      select: { userId: true },
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
