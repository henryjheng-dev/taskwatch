import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardRole } from '@/generated/prisma/client';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────── Board CRUD ────────────────────────────────

  /**
   * 建立新看板：
   * 1. 建立 Board 紀錄（ownerId = 當前使用者）
   * 2. 同步在 board_members 插入一筆 ADMIN 記錄
   *    → 確保 owner 一定在成員列表中，簡化後續「成員查詢」邏輯
   *
   * 使用 Prisma 的巢狀寫入（nested create），兩個 INSERT 在同一筆交易中完成。
   */
  async create(userId: number, dto: CreateBoardDto) {
    return this.prisma.board.create({
      data: {
        name: dto.name,
        backgroundColor: dto.backgroundColor,
        ownerId: userId,
        boardMembers: {
          create: { userId, role: BoardRole.ADMIN },
        },
      },
      include: { boardMembers: { select: { userId: true, role: true } } },
    });
  }

  /**
   * 列出「我有加入的」看板（包含自己建立的）。
   * 透過 board_members 關聯查詢，而非直接看 ownerId，
   * 使 owner 與一般 member 的查詢路徑保持一致。
   */
  findAll(userId: number): Promise<any> {
    return this.prisma.board.findMany({
      where: {
        boardMembers: { some: { userId } },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        backgroundColor: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { columns: true, boardMembers: true } },
      },
    });
  }

  /**
   * 取得看板詳情（含欄位 + 任務）。
   * 只有成員才能看，非成員直接拋 404（而非 403），避免洩漏「該 Board 存在」的資訊。
   * （OWASP: Object-Level Authorization）
   */
  async findOne(boardId: number, userId: number) {
    await this.assertMember(boardId, userId);

    return this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              orderBy: { position: 'asc' },
              include: {
                taskLabels: { include: { label: true } },
                taskAssignees: {
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
        },
        boardMembers: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        labels: true,
      },
    });
  }

  /** 更新看板設定，只有 ADMIN 成員可執行。 */
  async update(boardId: number, userId: number, dto: UpdateBoardDto) {
    await this.assertAdmin(boardId, userId);
    return this.prisma.board.update({
      where: { id: boardId },
      data: dto,
    });
  }

  /** 刪除看板，只有 owner 可執行（ADMIN 不夠，必須是建立者）。 */
  async remove(boardId: number, userId: number) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException('看板不存在');
    if (board.ownerId !== userId) {
      throw new ForbiddenException('只有看板擁有者才能刪除看板');
    }
    await this.prisma.board.delete({ where: { id: boardId } });
  }

  // ──────────────────────────── Members ──────────────────────────────────

  /** 列出成員，只有成員才能查看。 */
  async findMembers(boardId: number, userId: number) {
    await this.assertMember(boardId, userId);
    return this.prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * 新增成員，只有 ADMIN 可執行。
   * 以 email 查找使用者，使 API 不暴露 userId（防止 IDOR）。
   * 若 email 不存在拋 404（不提示「此 email 未註冊」，防止 User Enumeration）。
   */
  async addMember(boardId: number, requesterId: number, dto: AddMemberDto) {
    await this.assertAdmin(boardId, requesterId);

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // 統一拋 404，不區分「email 不存在」或「已是成員」，避免洩漏使用者資訊
    if (!targetUser) throw new NotFoundException('找不到此 Email 對應的使用者');

    // upsert：若已是成員只更新 role，避免 unique constraint 衝突
    return this.prisma.boardMember.upsert({
      where: { boardId_userId: { boardId, userId: targetUser.id } },
      create: {
        boardId,
        userId: targetUser.id,
        role: dto.role ?? BoardRole.MEMBER,
      },
      update: { role: dto.role ?? BoardRole.MEMBER },
    });
  }

  /** 更新成員角色，只有 ADMIN 可執行；不能降低自己的 ADMIN 權限。 */
  async updateMemberRole(
    boardId: number,
    targetUserId: number,
    requesterId: number,
    dto: UpdateMemberRoleDto,
  ) {
    await this.assertAdmin(boardId, requesterId);

    // 防止 ADMIN 自己把自己降級，導致看板無管理員
    if (targetUserId === requesterId && dto.role !== BoardRole.ADMIN) {
      throw new ForbiddenException('無法降低自己的管理員權限');
    }

    return this.prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      data: { role: dto.role },
    });
  }

  /**
   * 移除成員，ADMIN 可移除任何成員；一般成員只能移除自己（Leave board）。
   * owner 不能被移除（必須先轉讓看板）。
   */
  async removeMember(
    boardId: number,
    targetUserId: number,
    requesterId: number,
  ) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException('看板不存在');

    if (board.ownerId === targetUserId) {
      throw new ForbiddenException('看板擁有者無法被移除，請先轉讓看板');
    }

    const requester = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: requesterId } },
    });
    const isAdmin = requester?.role === BoardRole.ADMIN;
    const isSelf = targetUserId === requesterId;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('您沒有權限移除此成員');
    }

    await this.prisma.boardMember.delete({
      where: { boardId_userId: { boardId, userId: targetUserId } },
    });
  }

  // ──────────────────────────── Helpers ──────────────────────────────────

  /**
   * 確認使用者是看板成員，否則拋 404（隱藏看板是否存在的資訊）。
   * 回傳 BoardMember 記錄，讓呼叫者可以進一步檢查 role。
   */
  async assertMember(boardId: number, userId: number) {
    const member = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (!member) throw new NotFoundException('看板不存在或您不是成員');
    return member;
  }

  /**
   * 確認使用者是 ADMIN，否則拋 403。
   * 先呼叫 assertMember 確認成員資格（404），再確認角色（403）。
   */
  async assertAdmin(boardId: number, userId: number) {
    const member = await this.assertMember(boardId, userId);
    if (member.role !== BoardRole.ADMIN) {
      throw new ForbiddenException('需要 ADMIN 權限才能執行此操作');
    }
    return member;
  }
}
