import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthRequest } from '../auth/interface';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ──────────────────── 巢狀路由（Task 屬於 Column 屬於 Board）─────────────────────

  /** POST /boards/:boardId/columns/:columnId/tasks → 201 */
  @Post('boards/:boardId/columns/:columnId/tasks')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(boardId, columnId, req.user.id, dto);
  }

  // ──────────────────── 頂層路由（Task ID 即可定位資源）────────────────────────────

  /** GET /tasks/:id → 200 任務詳情（含 labels、assignees） */
  @Get('tasks/:id')
  findOne(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.tasksService.findOne(id, req.user.id);
  }

  /** PATCH /tasks/:id → 200 更新任務內容 */
  @Patch('tasks/:id')
  update(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, req.user.id, dto);
  }

  /** DELETE /tasks/:id → 204 */
  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.tasksService.remove(id, req.user.id);
  }

  /**
   * PATCH /tasks/:id/move → 200 拖曳移動任務
   * 使用獨立 endpoint 而非混入 PATCH /tasks/:id，
   * 語意更清晰，前端也能以不同的 Loading 狀態區分「編輯」和「移動」操作。
   */
  @Patch('tasks/:id/move')
  move(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasksService.move(id, req.user.id, dto);
  }
}
