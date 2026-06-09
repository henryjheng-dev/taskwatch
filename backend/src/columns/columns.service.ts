import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from '../boards/boards.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
  ) {}

  /**
   * 建立欄位：
   * - 呼叫 assertMember 確認使用者有存取此看板的權限
   * - position 未提供時自動取「現有欄位數量」作為末尾位置
   */
  async create(boardId: number, userId: number, dto: CreateColumnDto) {
    await this.boardsService.assertMember(boardId, userId);

    const position =
      dto.position ?? (await this.prisma.column.count({ where: { boardId } }));

    return this.prisma.column.create({
      data: { boardId, name: dto.name, position },
    });
  }

  /** 列出欄位（含任務），依 position 排序。 */
  async findAll(boardId: number, userId: number) {
    await this.boardsService.assertMember(boardId, userId);

    return this.prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
      include: {
        tasks: { orderBy: { position: 'asc' } },
      },
    });
  }

  /** 更新欄位名稱或 position，需要 ADMIN 權限。 */
  async update(
    boardId: number,
    columnId: number,
    userId: number,
    dto: UpdateColumnDto,
  ) {
    await this.boardsService.assertAdmin(boardId, userId);
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
   */
  async reorder(boardId: number, userId: number, dto: ReorderColumnsDto) {
    await this.boardsService.assertAdmin(boardId, userId);

    await this.prisma.$transaction(
      dto.columns.map(({ id, position }) =>
        this.prisma.column.update({
          where: { id },
          data: { position },
        }),
      ),
    );
  }

  /**
   * 刪除欄位（包含其下所有 Task，因 Prisma schema 設定了 onDelete: Cascade）。
   * 需要 ADMIN 權限。
   */
  async remove(boardId: number, columnId: number, userId: number) {
    await this.boardsService.assertAdmin(boardId, userId);
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
