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
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

type AuthRequest = Request & { user: AuthUser };

/** 標籤是看板層級的資源，路由掛在 /boards/:boardId/labels */
@UseGuards(JwtAuthGuard)
@Controller('boards/:boardId/labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  /** POST /boards/:boardId/labels → 201 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: CreateLabelDto,
  ) {
    return this.labelsService.create(boardId, req.user.id, dto);
  }

  /** GET /boards/:boardId/labels → 200 */
  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.labelsService.findAll(boardId, req.user.id);
  }

  /** PATCH /boards/:boardId/labels/:id → 200 */
  @Patch(':id')
  update(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.labelsService.update(boardId, id, req.user.id, dto);
  }

  /** DELETE /boards/:boardId/labels/:id → 204 */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() req: AuthRequest,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.labelsService.remove(boardId, id, req.user.id);
  }
}
