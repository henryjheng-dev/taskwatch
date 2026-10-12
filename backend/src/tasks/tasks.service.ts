import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from '../boards/boards.service';
import { ColumnsService } from '../columns/columns.service';
import { LabelsService } from '../labels/labels.service';
import { AuthorizationService } from '../common/authz/authorization.service';
import { Permission } from '../common/authz/permission.enum';
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
    private readonly authz: AuthorizationService,
  ) {}

  // ────────────────────────── Task CRUD ──────────────────────────────────

  /**
   * 建立任務：
   * 1. requirePermission(CREATE_TASK) 確認權限
   * 2. 確認 column 存在且屬於 boardId
   * 3. position 自動計算（同 column 的現有任務數量）
   */
  async create(
    boardId: number,
    columnId: number,
    userId: number,
    dto: CreateTaskDto,
  ) {
    await this.authz.requirePermission(userId, boardId, Permission.CREATE_TASK);
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

    await this.authz.requirePermission(
      userId,
      task.column.boardId,
      Permission.VIEW_BOARD,
    );
    return task;
  }

  /** 更新任務內容，需要 UPDATE_TASK 權限。 */
  async update(taskId: number, userId: number, dto: UpdateTaskDto) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    await this.authz.requirePermission(userId, boardId, Permission.UPDATE_TASK);
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

  /** 刪除任務：DELETE_TASK 權限者 或 任務建立者（關係型規則）。 */
  async remove(taskId: number, userId: number) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    const member = await this.authz.requireMember(boardId, userId);
    await this.boardsService.assertNotArchived(boardId);

    this.authz.requireCreatorOrAdmin(
      task,
      member,
      Permission.DELETE_TASK,
      '只有 ADMIN 或任務建立者才能刪除任務',
    );

    await this.prisma.task.delete({ where: { id: taskId } });
  }

  /**
   * 移動任務（跨欄位或同欄位排序）。
   * targetColumnId 未傳代表只調整同欄位的 position。
   */
  async move(taskId: number, userId: number, dto: MoveTaskDto) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    await this.authz.requirePermission(userId, boardId, Permission.MOVE_TASK);
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

  /** 指派成員到任務，需要 ASSIGN_TASK 權限。 */
  async addAssignee(taskId: number, targetUserId: number, requesterId: number) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;

    await this.authz.requirePermission(
      requesterId,
      boardId,
      Permission.ASSIGN_TASK,
    );
    await this.boardsService.assertNotArchived(boardId);

    // 確認被指派者也是看板成員
    await this.authz.requireMember(boardId, targetUserId);

    return this.prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId, userId: targetUserId } },
      create: { taskId, userId: targetUserId },
      update: {},
    });
  }

  /** 移除指派：REMOVE_ASSIGNEE 權限者 或 被指派者本人（關係型規則）。 */
  async removeAssignee(
    taskId: number,
    targetUserId: number,
    requesterId: number,
  ) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    const member = await this.authz.requireMember(boardId, requesterId);
    await this.boardsService.assertNotArchived(boardId);

    this.authz.requireSelfOrAdmin(
      targetUserId,
      member,
      Permission.REMOVE_ASSIGNEE,
      '只有 ADMIN 或本人才能移除指派',
    );

    await this.prisma.taskAssignee.delete({
      where: { taskId_userId: { taskId, userId: targetUserId } },
    });
  }

  // ──────────────────────────── Labels ───────────────────────────────────

  /** 為任務貼上標籤，需要 UPDATE_TASK_LABELS 權限。 */
  async attachLabel(taskId: number, labelId: number, userId: number) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.UPDATE_TASK_LABELS,
    );
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

  /** 移除任務標籤，需要 UPDATE_TASK_LABELS 權限。 */
  async detachLabel(taskId: number, labelId: number, userId: number) {
    const task = await this.getTaskWithBoard(taskId);
    const boardId = task.column.boardId;
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.UPDATE_TASK_LABELS,
    );
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
