import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardRole } from '@/generated/prisma/client';
import { AuthorizationService } from '../common/authz/authorization.service';
import { Permission } from '../common/authz/permission.enum';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

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
  async findAll(userId: number) {
    return this.prisma.board.findMany({
      where: {
        boardMembers: { some: { userId } },
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        backgroundColor: true,
        ownerId: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { columns: true, boardMembers: true } },
      },
    });
  }

  /** 列出我有加入的「已封存」看板 */
  async findArchived(userId: number) {
    return this.prisma.board.findMany({
      where: {
        boardMembers: { some: { userId } },
        archivedAt: { not: null },
      },
      orderBy: { archivedAt: 'desc' },
      select: {
        id: true,
        name: true,
        backgroundColor: true,
        ownerId: true,
        archivedAt: true,
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
    await this.authz.requireMember(boardId, userId);

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

  /** 更新看板設定，需要 UPDATE_BOARD 權限。 */
  async update(boardId: number, userId: number, dto: UpdateBoardDto) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.UPDATE_BOARD,
    );
    await this.assertNotArchived(boardId);
    return this.prisma.board.update({
      where: { id: boardId },
      data: dto,
    });
  }

  /** 刪除看板，只有 owner 可執行（關係型規則，不走角色矩陣）。 */
  async remove(boardId: number, userId: number) {
    // 先確認是成員：非成員一律 404，避免洩漏看板存在性
    await this.authz.requireMember(boardId, userId);

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException('看板不存在');
    this.authz.requireOwner(board, userId, '只有看板擁有者才能刪除看板');
    await this.prisma.board.delete({ where: { id: boardId } });
  }

  /** 封存看板，需要 ARCHIVE_BOARD 權限。 */
  async archive(boardId: number, userId: number) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.ARCHIVE_BOARD,
    );
    return this.prisma.board.update({
      where: { id: boardId },
      data: { archivedAt: new Date() },
    });
  }

  /** 恢復看板，需要 RESTORE_BOARD 權限。 */
  async restore(boardId: number, userId: number) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.RESTORE_BOARD,
    );
    return this.prisma.board.update({
      where: { id: boardId },
      data: { archivedAt: null },
    });
  }

  // ──────────────────────────── Members ──────────────────────────────────

  /** 列出成員，需要 VIEW_MEMBERS 權限。 */
  async findMembers(boardId: number, userId: number) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.VIEW_MEMBERS,
    );
    return this.prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /** 搜尋使用者（排除已是看板成員的），用於邀請功能，需要 SEARCH_MEMBERS 權限 */
  async searchUsers(boardId: number, userId: number, query: string) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.SEARCH_MEMBERS,
    );

    // 空字串或過短關鍵字不回傳名單，避免變成使用者目錄列舉
    const keyword = query.trim();
    if (keyword.length < 2) return [];

    const memberIds = await this.prisma.boardMember.findMany({
      where: { boardId },
      select: { userId: true },
    });
    return this.prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: keyword } },
              { email: { contains: keyword } },
            ],
          },
          { id: { notIn: memberIds.map((m) => m.userId) } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });
  }

  /**
   * 新增成員，需要 ADD_MEMBER 權限。
   * 先用 query 比對 name，找不到再比對 email。
   * 若都找不到拋 404（不提示哪個欄位不存在，防止 User Enumeration）。
   */
  async addMember(boardId: number, requesterId: number, dto: AddMemberDto) {
    await this.authz.requirePermission(
      requesterId,
      boardId,
      Permission.ADD_MEMBER,
    );
    await this.assertNotArchived(boardId);

    const query = dto.query.trim();

    // 同名可能有多人：不明確時要求改用 Email，避免加到錯誤的人
    const nameMatches = await this.prisma.user.findMany({
      where: { name: query },
      take: 2,
    });
    if (nameMatches.length > 1) {
      throw new BadRequestException('找到多位同名使用者，請改用 Email 邀請');
    }

    let targetUser: { id: number } | null = nameMatches[0] ?? null;
    if (!targetUser) {
      targetUser = await this.prisma.user.findFirst({
        where: { email: query },
        select: { id: true },
      });
    }
    if (!targetUser) throw new NotFoundException('找不到此使用者');

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

  /**
   * 更新成員角色，需要 UPDATE_MEMBER_ROLE 權限。
   * - 不能降低自己的 ADMIN 權限（防止看板無管理員）
   * - owner 的角色一律不可變更（ownerId 特權不進矩陣，改角色會造成權力分裂）
   */
  async updateMemberRole(
    boardId: number,
    targetUserId: number,
    requesterId: number,
    dto: UpdateMemberRoleDto,
  ) {
    await this.authz.requirePermission(
      requesterId,
      boardId,
      Permission.UPDATE_MEMBER_ROLE,
    );
    await this.assertNotArchived(boardId);

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    if (board?.ownerId === targetUserId) {
      throw new ForbiddenException('看板擁有者的角色無法變更');
    }

    // 防止 ADMIN 自己把自己降級，導致看板無管理員
    if (targetUserId === requesterId && dto.role !== BoardRole.ADMIN) {
      throw new ForbiddenException('無法降低自己的管理員權限');
    }

    const target = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      select: { userId: true },
    });
    if (!target) throw new NotFoundException('成員不存在');

    return this.prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      data: { role: dto.role },
    });
  }

  /**
   * 移除成員：ADMIN（REMOVE_MEMBER 權限）可移除任何成員；
   * 一般成員只能移除自己（Leave board，關係型規則）。
   * owner 不能被移除（必須先轉讓看板）。
   */
  async removeMember(
    boardId: number,
    targetUserId: number,
    requesterId: number,
  ) {
    // 先確認請求者是成員：非成員一律 404，避免洩漏看板存在性
    const requester = await this.authz.requireMember(boardId, requesterId);
    await this.assertNotArchived(boardId);

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    if (!board) throw new NotFoundException('看板不存在');

    if (board.ownerId === targetUserId) {
      throw new ForbiddenException('看板擁有者無法被移除，請先轉讓看板');
    }

    this.authz.requireSelfOrAdmin(
      targetUserId,
      requester,
      Permission.REMOVE_MEMBER,
      '您沒有權限移除此成員',
    );

    const target = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      select: { userId: true },
    });
    if (!target) throw new NotFoundException('成員不存在');

    await this.prisma.boardMember.delete({
      where: { boardId_userId: { boardId, userId: targetUserId } },
    });
  }

  // ──────────────────────────── Search / Recent ──────────────────────────

  /**
   * 搜尋使用者有權限查看的看板（透過 boardMembers 關聯）。
   * 搜尋範圍限於使用者是 owner 或 member 的看板，不可跨權限查詢。
   */
  async search(userId: number, query: string) {
    // 空字串或過短關鍵字不回傳清單，避免行為等同「列出全部」
    const keyword = query.trim();
    if (keyword.length < 2) return [];

    return this.prisma.board.findMany({
      where: {
        boardMembers: { some: { userId } },
        name: { contains: keyword },
        archivedAt: null,
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, updatedAt: true },
    });
  }

  /**
   * 回傳使用者最近更新的 3 個看板。
   */
  async findRecent(userId: number) {
    return this.prisma.board.findMany({
      where: {
        boardMembers: { some: { userId } },
        archivedAt: null,
      },
      take: 3,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, updatedAt: true },
    });
  }

  // ──────────────────────────── Helpers ──────────────────────────────────

  /** 確認看板未封存，否則拋 Forbidden。 */
  async assertNotArchived(boardId: number) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { archivedAt: true },
    });
    if (board?.archivedAt) {
      throw new ForbiddenException('看板已封存，無法執行此操作');
    }
  }
}
