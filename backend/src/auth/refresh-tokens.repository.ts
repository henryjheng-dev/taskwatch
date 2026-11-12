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

  async findOne(rawToken: string): Promise<{
    userId: number;
    revokedAt: Date | null;
    expiresAt: Date;
  } | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
  }

  async revokeOne(rawToken: string): Promise<{ userId: number } | null> {
    const now = new Date();

    const result = await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(rawToken),
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    if (result.count === 0) {
      return null;
    }

    const record = await this.findOne(rawToken);
    return record ? { userId: record.userId } : null;
  }

  async deleteAllForUser(userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
