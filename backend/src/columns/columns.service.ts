import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from '../boards/boards.service';
import { AuthorizationService } from '../common/authz/authorization.service';
import { Permission } from '../common/authz/permission.enum';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * 建立欄位：
   * - requirePermission(CREATE_COLUMN) 確認使用者有此權限
   * - position 未提供時自動取「現有欄位數量」作為末尾位置
   */
  async create(boardId: number, userId: number, dto: CreateColumnDto) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.CREATE_COLUMN,
    );
    await this.boardsService.assertNotArchived(boardId);

    const position =
      dto.position ?? (await this.prisma.column.count({ where: { boardId } }));

    return this.prisma.column.create({
      data: { boardId, name: dto.name, position },
    });
  }

  /** 列出欄位（含任務），依 position 排序。 */
  async findAll(boardId: number, userId: number) {
    await this.authz.requirePermission(userId, boardId, Permission.VIEW_BOARD);

    return this.prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
      include: {
        tasks: { orderBy: { position: 'asc' } },
      },
    });
  }

  /** 更新欄位名稱或 position，需要 UPDATE_COLUMN 權限。 */
  async update(
    boardId: number,
    columnId: number,
    userId: number,
    dto: UpdateColumnDto,
  ) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.UPDATE_COLUMN,
    );
    await this.boardsService.assertNotArchived(boardId);
    await this.assertColumnBelongsToBoard(columnId, boardId);

    return this.prisma.column.update({
      where: { id: columnId },
      data: dto,
    });
  }

  /**
   * 批次重新排序所有欄位。
   * 使用 Prisma.$transaction 確保所有 UPDATE 要麼全部成功，要麼全部回滾。
   * 這是拖曳排序的標準實作模式。
   *
   * 防跨看板 IDOR：在交易內先抓出本看板所有欄位做白名單，
   * 校驗 payload 必須「恰好包含」該看板全部欄位（不得缺漏、不得含外來 id、不得重複）。
   */
  async reorder(boardId: number, userId: number, dto: ReorderColumnsDto) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.REORDER_COLUMNS,
    );
    await this.boardsService.assertNotArchived(boardId);

    await this.prisma.$transaction(async (tx) => {
      const boardColumns = await tx.column.findMany({
        where: { boardId },
        select: { id: true },
      });
      const validIds = new Set(boardColumns.map((c) => c.id));
      const payloadIds = dto.columns.map((c) => c.id);

      // 重複 id 直接拒絕（防 payload 塞同一個 id 繞過全量校驗）
      if (new Set(payloadIds).size !== payloadIds.length) {
        throw new BadRequestException('排序清單包含重複的欄位');
      }
      // 全量語意：payload 必須恰好涵蓋本看板所有欄位
      if (payloadIds.length !== validIds.size) {
        throw new BadRequestException('排序清單必須包含看板的所有欄位');
      }
      for (const id of payloadIds) {
        if (!validIds.has(id)) {
          throw new NotFoundException('欄位不屬於此看板');
        }
      }

      await Promise.all(
        dto.columns.map(({ id, position }) =>
          tx.column.update({
            where: { id },
            data: { position },
          }),
        ),
      );
    });
  }

  /**
   * 刪除欄位（包含其下所有 Task，因 Prisma schema 設定了 onDelete: Cascade）。
   * 需要 DELETE_COLUMN 權限。
   */
  async remove(boardId: number, columnId: number, userId: number) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.DELETE_COLUMN,
    );
    await this.boardsService.assertNotArchived(boardId);
    await this.assertColumnBelongsToBoard(columnId, boardId);

    await this.prisma.column.delete({ where: { id: columnId } });
  }

  // ─────────────────────── Helper ────────────────────────────────────────

  /**
   * 防止跨看板操作：確認 column 確實屬於指定的 board。
   * 若不屬於，拋 404（不洩漏 column 是否存在於其他看板）。
   */
  async assertColumnBelongsToBoard(columnId: number, boardId: number) {
    const column = await this.prisma.column.findFirst({
      where: { id: columnId, boardId },
    });
    if (!column) throw new NotFoundException('欄位不存在');
    return column;
  }
}
