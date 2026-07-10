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
   * 原子撤銷單一 token。
   * 回傳被撤銷的記錄（含 userId），若 token 不存在或已撤銷則回傳 null。
   */
  async revokeOne(rawToken: string): Promise<{ userId: number } | null> {
    // updateMany 的 WHERE 本身是原子的：
    // 兩個併發請求只有一個能拿到 count = 1，另一個拿到 count = 0
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        token: rawToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });
    /**
     * conut === 0 代表 mysql 沒有任何資料被更新，可能是因為token不存在、已過期或已被撤銷。
     */
    if (result.count === 0) {
      return null;
    }

    // 取得 userId 供後續使用
    const record = await this.prisma.refreshToken.findFirst({
      where: { token: rawToken },
      select: { userId: true },
    });

    return record ?? null;
  }

  /**
   * 檢查 token 是否曾存在但已被撤銷（用於偵測重複使用）
   */
  async findRevoked(rawToken: string): Promise<{ userId: number } | null> {
    const record = await this.prisma.refreshToken.findFirst({
      where: { token: rawToken, revokedAt: { not: null } },
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
