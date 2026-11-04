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

    if (result.count === 0) {
      return null;
    }

    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(rawToken) },
      select: { userId: true },
    });

    return record ?? null;
  }

  async findRevoked(rawToken: string): Promise<{ userId: number } | null> {
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(rawToken), revokedAt: { not: null } },
      select: { userId: true },
    });
    return record ?? null;
  }

  async revokeAll(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
