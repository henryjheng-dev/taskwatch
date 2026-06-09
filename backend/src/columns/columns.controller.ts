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
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { ColumnsService } from './columns.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';

type AuthRequest = Request & { user: AuthUser };

/**
 * 欄位路由掛在 /boards/:boardId/columns 下，
 * 體現資源的巢狀關係：Column 是 Board 的子資源。
 */
@UseGuards(JwtAuthGuard)
@Controller('boards/:boardId/columns')
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  /** POST /boards/:boardId/columns → 201 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: CreateColumnDto,
  ) {
    return this.columnsService.create(boardId, req.user.id, dto);
  }

  /** GET /boards/:boardId/columns → 200 */
  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.columnsService.findAll(boardId, req.user.id);
  }

  /** PATCH /boards/:boardId/columns/reorder → 200 批次排序 */
  @Patch('reorder')
  reorder(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: ReorderColumnsDto,
  ) {
    return this.columnsService.reorder(boardId, req.user.id, dto);
  }

  /** PATCH /boards/:boardId/columns/:id → 200 */
  @Patch(':id')
  update(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.columnsService.update(boardId, id, req.user.id, dto);
  }

  /** DELETE /boards/:boardId/columns/:id → 204 */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.columnsService.remove(boardId, id, req.user.id);
  }
}
