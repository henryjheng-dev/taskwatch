import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { BoardRole } from '@/generated/prisma/client';
import { Permission } from './permission.enum';
import { ROLE_PERMISSIONS } from './role-permissions';

export interface BoardMemberIdentity {
  userId: number;
  role: BoardRole;
}

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}
  async findMember(
    boardId: number,
    userId: number,
  ): Promise<BoardMemberIdentity | null> {
    return this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { userId: true, role: true },
    });
  }

  async requireMember(
    boardId: number,
    userId: number,
  ): Promise<BoardMemberIdentity> {
    const member = await this.findMember(boardId, userId);
    if (!member) throw new NotFoundException('看板不存在或您不是成員');
    return member;
  }

  async requirePermission(
    userId: number,
    boardId: number,
    permission: Permission,
  ): Promise<BoardMemberIdentity> {
    const member = await this.requireMember(boardId, userId);
    if (!ROLE_PERMISSIONS[member.role].has(permission)) {
      throw new ForbiddenException('您沒有權限執行此操作');
    }
    return member;
  }

  requireOwner(board: { ownerId: number }, userId: number, message?: string) {
    if (board.ownerId !== userId) {
      throw new ForbiddenException(message ?? '只有看板擁有者才能執行此操作');
    }
  }

  requireCreatorOrAdmin(
    target: { createdBy: number },
    member: BoardMemberIdentity,
    permission: Permission,
    message?: string,
  ) {
    if (target.createdBy === member.userId) return;
    if (ROLE_PERMISSIONS[member.role].has(permission)) return;
    throw new ForbiddenException(message ?? '只有管理員或建立者才能執行此操作');
  }

  requireSelfOrAdmin(
    targetUserId: number,
    member: BoardMemberIdentity,
    permission: Permission,
    message?: string,
  ) {
    if (targetUserId === member.userId) return;
    if (ROLE_PERMISSIONS[member.role].has(permission)) return;
    throw new ForbiddenException(message ?? '您沒有權限執行此操作');
  }
}
