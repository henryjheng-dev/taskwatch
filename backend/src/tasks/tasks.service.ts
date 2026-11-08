import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardsService } from '../boards/boards.service';
import { ColumnsService } from '../columns/columns.service';
import { AuthorizationService } from '../common/authz/authorization.service';
import { Permission } from '../common/authz/permission.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
    private readonly columnsService: ColumnsService,
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
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        position,
      },
    });
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
