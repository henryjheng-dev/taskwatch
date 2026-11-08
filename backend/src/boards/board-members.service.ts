import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoardRole, Prisma } from '@/generated/prisma/client';
import { AuthorizationService } from '../common/authz/authorization.service';
import { Permission } from '../common/authz/permission.enum';
import { BoardsService } from './boards.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class BoardMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly boardsService: BoardsService,
  ) {}

  async findMembers(boardId: number, userId: number) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.VIEW_MEMBERS,
    );
    return this.prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /** 搜尋使用者（排除已是看板成員的），用於邀請功能，需要 SEARCH_MEMBERS 權限 */
  async searchUsers(boardId: number, userId: number, query: string) {
    await this.authz.requirePermission(
      userId,
      boardId,
      Permission.SEARCH_MEMBERS,
    );

    // 空字串不回傳名單（避免等於列出全部）；1 個字即可搜尋，符合中文姓氏情境
    const keyword = query.trim();
    if (!keyword) return [];

    const memberIds = await this.prisma.boardMember.findMany({
      where: { boardId },
      select: { userId: true },
    });
    return this.prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: keyword } },
              { email: { contains: keyword } },
            ],
          },
          { id: { notIn: memberIds.map((m) => m.userId) } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });
  }

  async addMember(boardId: number, requesterId: number, dto: AddMemberDto) {
    await this.authz.requirePermission(
      requesterId,
      boardId,
      Permission.ADD_MEMBER,
    );
    await this.boardsService.assertNotArchived(boardId);

    const query = dto.query.trim();

    // 同名可能有多人：不明確時要求改用 Email，避免加到錯誤的人
    const nameMatches = await this.prisma.user.findMany({
      where: { name: query },
      take: 2,
    });
    if (nameMatches.length > 1) {
      throw new BadRequestException('找到多位同名使用者，請改用 Email 邀請');
    }

    let targetUser: { id: number } | null = nameMatches[0] ?? null;
    if (!targetUser) {
      targetUser = await this.prisma.user.findFirst({
        where: { email: query },
        select: { id: true },
      });
    }
    if (!targetUser) throw new NotFoundException('找不到此使用者');

    try {
      return await this.prisma.boardMember.create({
        data: {
          boardId,
          userId: targetUser.id,
          role: dto.role ?? BoardRole.MEMBER,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('此使用者已是看板成員');
      }
      throw error;
    }
  }

  async updateMemberRole(
    boardId: number,
    targetUserId: number,
    requesterId: number,
    dto: UpdateMemberRoleDto,
  ) {
    await this.authz.requirePermission(
      requesterId,
      boardId,
      Permission.UPDATE_MEMBER_ROLE,
    );
    await this.boardsService.assertNotArchived(boardId);

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    if (board?.ownerId === targetUserId) {
      throw new ForbiddenException('看板擁有者的角色無法變更');
    }

    // 防止 ADMIN 自己把自己降級，導致看板無管理員
    if (targetUserId === requesterId && dto.role !== BoardRole.ADMIN) {
      throw new ForbiddenException('無法降低自己的管理員權限');
    }

    const target = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      select: { userId: true },
    });
    if (!target) throw new NotFoundException('成員不存在');

    return this.prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      data: { role: dto.role },
    });
  }

  async removeMember(
    boardId: number,
    targetUserId: number,
    requesterId: number,
  ) {
    const requester = await this.authz.requireMember(boardId, requesterId);
    await this.boardsService.assertNotArchived(boardId);

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    if (!board) throw new NotFoundException('看板不存在');

    if (board.ownerId === targetUserId) {
      throw new ForbiddenException('看板擁有者無法被移除，請先轉讓看板');
    }

    this.authz.requireSelfOrAdmin(
      targetUserId,
      requester,
      Permission.REMOVE_MEMBER,
      '您沒有權限移除此成員',
    );

    const target = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      select: { userId: true },
    });
    if (!target) throw new NotFoundException('成員不存在');

    await this.prisma.boardMember.delete({
      where: { boardId_userId: { boardId, userId: targetUserId } },
    });
  }
}
