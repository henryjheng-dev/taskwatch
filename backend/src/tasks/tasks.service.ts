import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from '../boards/boards.service';
import { ColumnsService } from '../columns/columns.service';
import { LabelsService } from '../labels/labels.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';

/** 任務詳情 select：統一 include 邏輯，避免各方法重複寫 */
const TASK_DETAIL_INCLUDE = {
  taskLabels: { include: { label: true } },
  taskAssignees: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
  creator: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
    private readonly columnsService: ColumnsService,
    private readonly labelsService: LabelsService,
  ) {}

  // ────────────────────────── Task CRUD ──────────────────────────────────

  /**
   * 建立任務：
   * 1. 確認 column 存在且屬於 boardId
   * 2. 確認使用者是看板成員
   * 3. position 自動計算（同 column 的現有任務數量）
   */
  async create(
    boardId: number,
    columnId: number,
    userId: number,
    dto: CreateTaskDto,
  ) {
    await this.boardsService.assertMember(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);
    await this.columnsService.assertColumnBelongsToBoard(columnId, boardId);

    const position =
      dto.position ?? (await this.prisma.task.count({ where: { columnId } }));

    return this.prisma.task.create({
      data: {
        columnId,
        createdBy: userId,
        title: dto.title,
        description: dto.description,
        linkUrl: dto.linkUrl,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        position,
      },
      include: TASK_DETAIL_INCLUDE,
    });
  }

  /**
   * 取得單一任務詳情。
   * 先確認任務存在，再透過 columnId → boardId 確認使用者有讀取權限。
   */
  async findOne(taskId: number, userId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        ...TASK_DETAIL_INCLUDE,
        column: { select: { boardId: true } },
      },
    });
    if (!task) throw new NotFoundException('任務不存在');

    await this.boardsService.assertMember(task.column.boardId, userId);
    return task;
  }

  /** 更新任務內容，任務成員（看板成員）皆可編輯。 */
  async update(taskId: number, userId: number, dto: UpdateTaskDto) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    await this.boardsService.assertMember(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...dto,
        dueDate:
          dto.dueDate !== undefined
            ? dto.dueDate === null
              ? null
              : new Date(dto.dueDate)
            : undefined,
      },
      include: TASK_DETAIL_INCLUDE,
    });
  }

  /** 刪除任務，需要看板 ADMIN 或任務建立者。 */
  async remove(taskId: number, userId: number) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    const member = await this.boardsService.assertMember(
      boardId,
      userId,
    );
    await this.boardsService.assertNotArchived(boardId);

    const isAdmin = member.role === 'ADMIN';
    const isCreator = task.createdBy === userId;
    if (!isAdmin && !isCreator) {
      throw new ForbiddenException('只有 ADMIN 或任務建立者才能刪除任務');
    }

    await this.prisma.task.delete({ where: { id: taskId } });
  }

  /**
   * 移動任務（跨欄位或同欄位排序）。
   * targetColumnId 未傳代表只調整同欄位的 position。
   */
  async move(taskId: number, userId: number, dto: MoveTaskDto) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    await this.boardsService.assertMember(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);

    const targetColumnId = dto.targetColumnId ?? task.columnId;

    // 若移動到不同欄位，確認目標欄位屬於同一看板
    if (dto.targetColumnId && dto.targetColumnId !== task.columnId) {
      await this.columnsService.assertColumnBelongsToBoard(
        dto.targetColumnId,
        boardId,
      );
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { columnId: targetColumnId, position: dto.position },
    });
  }

  // ────────────────────────── Assignees ──────────────────────────────────

  /** 指派成員到任務（任何看板成員都可以指派）。 */
  async addAssignee(taskId: number, targetUserId: number, requesterId: number) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;

    await this.boardsService.assertMember(boardId, requesterId);
    await this.boardsService.assertNotArchived(boardId);

    // 確認被指派者也是看板成員
    await this.boardsService.assertMember(boardId, targetUserId);

    return this.prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId, userId: targetUserId } },
      create: { taskId, userId: targetUserId },
      update: {},
    });
  }

  /** 移除指派（ADMIN 或被指派者本人）。 */
  async removeAssignee(
    taskId: number,
    targetUserId: number,
    requesterId: number,
  ) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    const member = await this.boardsService.assertMember(
      boardId,
      requesterId,
    );
    await this.boardsService.assertNotArchived(boardId);

    const isAdmin = member.role === 'ADMIN';
    const isSelf = targetUserId === requesterId;
    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('只有 ADMIN 或本人才能移除指派');
    }

    await this.prisma.taskAssignee.delete({
      where: { taskId_userId: { taskId, userId: targetUserId } },
    });
  }

  // ──────────────────────────── Labels ───────────────────────────────────

  /** 為任務貼上標籤（看板成員皆可）。 */
  async attachLabel(taskId: number, labelId: number, userId: number) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    await this.boardsService.assertMember(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);

    // 確認 label 屬於同一看板
    await this.labelsService.assertLabelBelongsToBoard(
      labelId,
      task.column.boardId,
    );

    return this.prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId, labelId } },
      create: { taskId, labelId },
      update: {},
    });
  }

  /** 移除任務標籤（看板成員皆可）。 */
  async detachLabel(taskId: number, labelId: number, userId: number) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    await this.boardsService.assertMember(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);

    await this.prisma.taskLabel.delete({
      where: { taskId_labelId: { taskId, labelId } },
    });
  }

  // ─────────────────────── Helper ────────────────────────────────────────

  /**
   * 取得任務同時帶入 column.boardId，
   * 供鑑權使用，集中查詢避免重複 DB 查詢。
   */
  private async getTaskWithBoard(taskId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { column: { select: { boardId: true } } },
    });
    if (!task) throw new NotFoundException('任務不存在');
    return task;
  }
}
