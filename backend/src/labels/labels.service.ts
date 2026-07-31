import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from '../boards/boards.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
  ) {}

  /** 建立標籤，需要 ADMIN 權限（標籤是看板層級的配置）。 */
  async create(boardId: number, userId: number, dto: CreateLabelDto) {
    await this.boardsService.assertAdmin(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);
    return this.prisma.label.create({
      data: { boardId, name: dto.name, color: dto.color },
    });
  }

  /** 列出看板的所有標籤，看板成員皆可查看。 */
  async findAll(boardId: number, userId: number) {
    await this.boardsService.assertMember(boardId, userId);
    return this.prisma.label.findMany({
      where: { boardId },
      orderBy: { id: 'asc' },
    });
  }

  /** 更新標籤，需要 ADMIN 權限。 */
  async update(
    boardId: number,
    labelId: number,
    userId: number,
    dto: UpdateLabelDto,
  ) {
    await this.boardsService.assertAdmin(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);
    await this.assertLabelBelongsToBoard(labelId, boardId);

    return this.prisma.label.update({
      where: { id: labelId },
      data: dto,
    });
  }

  /**
   * 刪除標籤，需要 ADMIN 權限。
   * Prisma schema 設定了 onDelete: Cascade，
   * 刪除 Label 時相關的 TaskLabel 記錄也會自動清除。
   */
  async remove(boardId: number, labelId: number, userId: number) {
    await this.boardsService.assertAdmin(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);
    await this.assertLabelBelongsToBoard(labelId, boardId);

    await this.prisma.label.delete({ where: { id: labelId } });
  }

  // ─────────────────────── Helper ────────────────────────────────────────

  /** 確認 label 屬於指定 board，防止跨看板操作。 */
  async assertLabelBelongsToBoard(labelId: number, boardId: number) {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, boardId },
    });
    if (!label) throw new NotFoundException('標籤不存在');
    return label;
  }
}
