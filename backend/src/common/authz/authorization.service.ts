import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { BoardRole } from '@/generated/prisma/client';
import { Permission } from './permission.enum';
import { ROLE_PERMISSIONS } from './role-permissions';

/** 成員身分：授權判斷所需的兩個欄位 */
export interface BoardMemberIdentity {
  userId: number;
  role: BoardRole;
}

/**
 * 授權服務：所有「角色型」與「關係型」權限判斷的統一入口。
 *
 * 角色型：requirePermission / can（查 ROLE_PERMISSIONS 矩陣）
 * 關係型：requireOwner / requireCreatorOrAdmin / requireSelfOrAdmin
 *
 * 取代舊的 assertMember / assertAdmin（散落各 service 的魔法字串），
 * 讓權限規則集中、可測、可搜尋。
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── 角色型（矩陣） ─────────────────────────

  /** 查詢使用者在此看板的成員身分，非成員回傳 null */
  async findMember(
    boardId: number,
    userId: number,
  ): Promise<BoardMemberIdentity | null> {
    return this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { userId: true, role: true },
    });
  }

  /** 要求為看板成員，否則 404（隱藏看板存在性，防列舉） */
  async requireMember(
    boardId: number,
    userId: number,
  ): Promise<BoardMemberIdentity> {
    const member = await this.findMember(boardId, userId);
    if (!member) throw new NotFoundException('看板不存在或您不是成員');
    return member;
  }

  /** 查詢是否有權限（不回傳例外，供條件判斷用） */
  async can(
    userId: number,
    boardId: number,
    permission: Permission,
  ): Promise<boolean> {
    const member = await this.findMember(boardId, userId);
    return !!member && ROLE_PERMISSIONS[member.role].has(permission);
  }

  /** 要求擁有指定權限：非成員 404、無權限 403；成功回傳成員身分 */
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

  // ───────────────────────── 關係型（policy） ────────────────────────

  /** owner 特權：只有看板擁有者能執行（不進角色矩陣） */
  requireOwner(board: { ownerId: number }, userId: number, message?: string) {
    if (board.ownerId !== userId) {
      throw new ForbiddenException(message ?? '只有看板擁有者才能執行此操作');
    }
  }

  /** 建立者 或 有指定權限者（例如刪任務：ADMIN 或任務建立者） */
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

  /** 本人 或 有指定權限者（例如移除指派：ADMIN 或被指派者本人） */
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
