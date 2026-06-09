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
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

/** 方便取得型別化的 req.user */
type AuthRequest = Request & { user: AuthUser };

/**
 * 所有 /boards 路由都需要 JWT 驗證。
 * @UseGuards 放在 class 層級代表套用到所有方法。
 */
@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  // ─────────────────────────── Board CRUD ────────────────────────────────

  /** POST /boards → 201 Created */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: AuthRequest, @Body() dto: CreateBoardDto) {
    return this.boardsService.create(req.user.id, dto);
  }

  /** GET /boards → 200 我的所有看板 */
  @Get()
  findAll(@Req() req: AuthRequest): Promise<any> {
    return this.boardsService.findAll(req.user.id);
  }

  /** GET /boards/:id → 200 看板詳情（含欄位＋任務） */
  @Get(':id')
  findOne(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.boardsService.findOne(id, req.user.id);
  }

  /** PATCH /boards/:id → 200 更新看板（ADMIN only） */
  @Patch(':id')
  update(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardsService.update(id, req.user.id, dto);
  }

  /** DELETE /boards/:id → 204 刪除看板（owner only） */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.boardsService.remove(id, req.user.id);
  }

  // ──────────────────────────── Members ──────────────────────────────────

  /** GET /boards/:id/members → 200 看板成員列表 */
  @Get(':id/members')
  findMembers(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.boardsService.findMembers(id, req.user.id);
  }

  /** POST /boards/:id/members → 201 新增成員（ADMIN only） */
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMemberDto,
  ) {
    return this.boardsService.addMember(id, req.user.id, dto);
  }

  /** PATCH /boards/:id/members/:userId → 200 更新成員角色（ADMIN only） */
  @Patch(':id/members/:userId')
  updateMemberRole(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.boardsService.updateMemberRole(
      id,
      targetUserId,
      req.user.id,
      dto,
    );
  }

  /** DELETE /boards/:id/members/:userId → 204 移除成員或離開看板 */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
  ) {
    return this.boardsService.removeMember(id, targetUserId, req.user.id);
  }
}
