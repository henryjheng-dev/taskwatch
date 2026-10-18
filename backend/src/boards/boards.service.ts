import {
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

const BOARD_DETAIL_INCLUDE = {
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
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  labels: true,
} as const;

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  // ─────────────────────────── Board CRUD ────────────────────────────────

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
      include: { ...BOARD_DETAIL_INCLUDE },
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
