import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BoardMembersService } from './board-members.service';
import { BoardRole, Prisma } from '@/generated/prisma/client';
import { Permission } from '../common/authz/permission.enum';

jest.mock(
  '@/generated/prisma/client',
  () => {
    class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(message: string, options: { code: string }) {
        super(message);
        this.name = 'PrismaClientKnownRequestError';
        this.code = options.code;
      }
    }

    return {
      BoardRole: { ADMIN: 'ADMIN', MEMBER: 'MEMBER', GUEST: 'GUEST' },
      Prisma: { PrismaClientKnownRequestError },
    };
  },
  { virtual: true },
);

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('./boards.service', () => ({
  BoardsService: class BoardsService {},
}));

describe('BoardMembersService', () => {
  let prisma: any;
  let authz: any;
  let boardsService: any;
  let service: BoardMembersService;

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      boardMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      board: {
        findUnique: jest.fn(),
      },
    };
    authz = {
      requirePermission: jest.fn(),
      requireMember: jest.fn(),
      requireSelfOrAdmin: jest.fn(),
    };
    boardsService = {
      assertNotArchived: jest.fn(),
    };

    authz.requirePermission.mockResolvedValue({
      userId: 1,
      role: BoardRole.ADMIN,
    });
    authz.requireMember.mockResolvedValue({
      userId: 1,
      role: BoardRole.ADMIN,
    });
    boardsService.assertNotArchived.mockResolvedValue(undefined);

    service = new BoardMembersService(
      prisma as never,
      authz as never,
      boardsService as never,
    );
  });

  describe('findMembers', () => {
    it('確認 VIEW_MEMBERS 權限後回傳成員列表', async () => {
      const members = [{ id: 1, userId: 1 }];
      prisma.boardMember.findMany.mockResolvedValue(members);

      await expect(service.findMembers(10, 1)).resolves.toEqual(members);
      expect(authz.requirePermission).toHaveBeenCalledWith(
        1,
        10,
        Permission.VIEW_MEMBERS,
      );
      expect(prisma.boardMember.findMany).toHaveBeenCalledWith({
        where: { boardId: 10 },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });
    });

    it('沒有權限時直接拋出錯誤，不查詢成員', async () => {
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(service.findMembers(10, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.boardMember.findMany).not.toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('空白關鍵字直接回傳空陣列，不查詢使用者', async () => {
      await expect(service.searchUsers(10, 1, '   ')).resolves.toEqual([]);
      expect(prisma.boardMember.findMany).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('trim 關鍵字並排除現有成員', async () => {
      prisma.boardMember.findMany.mockResolvedValue([
        { userId: 2 },
        { userId: 3 },
      ]);
      const users = [{ id: 4, name: 'Alice', email: 'alice@example.com' }];
      prisma.user.findMany.mockResolvedValue(users);

      await expect(service.searchUsers(10, 1, '  Ali  ')).resolves.toEqual(
        users,
      );
      expect(prisma.boardMember.findMany).toHaveBeenCalledWith({
        where: { boardId: 10 },
        select: { userId: true },
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: 'Ali' } },
                { email: { contains: 'Ali' } },
              ],
            },
            { id: { notIn: [2, 3] } },
          ],
        },
        select: { id: true, name: true, email: true },
        take: 10,
      });
    });

    it('沒有 SEARCH_MEMBERS 權限時不查詢', async () => {
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(service.searchUsers(10, 1, 'Ali')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.boardMember.findMany).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
    it('同名使用者超過一位時要求改用 Email', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 2 }, { id: 3 }]);

      await expect(
        service.addMember(10, 1, { query: 'Alice' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.boardMember.create).not.toHaveBeenCalled();
    });

    it('名稱找不到時改用 Email 查詢，未指定角色預設 MEMBER', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.findFirst.mockResolvedValue({ id: 5 });
      prisma.boardMember.create.mockResolvedValue({ id: 100 });

      await expect(
        service.addMember(10, 1, { query: ' alice@example.com ' }),
      ).resolves.toEqual({ id: 100 });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
        select: { id: true },
      });
      expect(prisma.boardMember.create).toHaveBeenCalledWith({
        data: {
          boardId: 10,
          userId: 5,
          role: BoardRole.MEMBER,
        },
      });
    });

    it('有指定角色時使用指定角色', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 5 }]);
      prisma.boardMember.create.mockResolvedValue({ id: 100 });

      await service.addMember(10, 1, {
        query: 'Alice',
        role: BoardRole.GUEST,
      });

      expect(prisma.boardMember.create).toHaveBeenCalledWith({
        data: {
          boardId: 10,
          userId: 5,
          role: BoardRole.GUEST,
        },
      });
    });

    it('找不到使用者時拋出 NotFoundException', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.addMember(10, 1, { query: 'nobody@example.com' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.boardMember.create).not.toHaveBeenCalled();
    });

    it('已是成員時將 P2002 轉成 ConflictException', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 5 }]);
      prisma.boardMember.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
        }),
      );

      await expect(
        service.addMember(10, 1, { query: 'Alice' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('非 P2002 的資料庫錯誤會原樣拋出', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 5 }]);
      const dbError = new Error('db down');
      prisma.boardMember.create.mockRejectedValue(dbError);

      await expect(
        service.addMember(10, 1, { query: 'Alice' }),
      ).rejects.toBe(dbError);
    });

    it('看板已封存時不查詢使用者', async () => {
      boardsService.assertNotArchived.mockRejectedValue(
        new ForbiddenException('看板已封存'),
      );

      await expect(
        service.addMember(10, 1, { query: 'Alice' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.boardMember.create).not.toHaveBeenCalled();
    });

    it('沒有 ADD_MEMBER 權限時不查詢使用者', async () => {
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(
        service.addMember(10, 1, { query: 'Alice' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(boardsService.assertNotArchived).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it('不能變更看板擁有者的角色', async () => {
      prisma.board.findUnique.mockResolvedValue({ ownerId: 5 });

      await expect(
        service.updateMemberRole(10, 5, 1, { role: BoardRole.MEMBER }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.boardMember.update).not.toHaveBeenCalled();
    });

    it('不能把自己從 ADMIN 降級', async () => {
      prisma.board.findUnique.mockResolvedValue({ ownerId: 99 });

      await expect(
        service.updateMemberRole(10, 1, 1, { role: BoardRole.MEMBER }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.boardMember.update).not.toHaveBeenCalled();
    });

    it('成員不存在時拋出 NotFoundException', async () => {
      prisma.board.findUnique.mockResolvedValue({ ownerId: 99 });
      prisma.boardMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(10, 5, 1, { role: BoardRole.MEMBER }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.boardMember.update).not.toHaveBeenCalled();
    });

    it('合法變更時更新目標成員角色', async () => {
      prisma.board.findUnique.mockResolvedValue({ ownerId: 99 });
      prisma.boardMember.findUnique.mockResolvedValue({ userId: 5 });
      prisma.boardMember.update.mockResolvedValue({
        userId: 5,
        role: BoardRole.GUEST,
      });

      await expect(
        service.updateMemberRole(10, 5, 1, { role: BoardRole.GUEST }),
      ).resolves.toEqual({ userId: 5, role: BoardRole.GUEST });

      expect(prisma.boardMember.update).toHaveBeenCalledWith({
        where: { boardId_userId: { boardId: 10, userId: 5 } },
        data: { role: BoardRole.GUEST },
      });
    });

    it('將自己維持 ADMIN 是允許的', async () => {
      prisma.board.findUnique.mockResolvedValue({ ownerId: 99 });
      prisma.boardMember.findUnique.mockResolvedValue({ userId: 1 });
      prisma.boardMember.update.mockResolvedValue({
        userId: 1,
        role: BoardRole.ADMIN,
      });

      await expect(
        service.updateMemberRole(10, 1, 1, { role: BoardRole.ADMIN }),
      ).resolves.toEqual({ userId: 1, role: BoardRole.ADMIN });
    });
  });

  describe('removeMember', () => {
    it('看板不存在時拋出 NotFoundException', async () => {
      prisma.board.findUnique.mockResolvedValue(null);

      await expect(service.removeMember(10, 5, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });

    it('不能移除看板擁有者', async () => {
      prisma.board.findUnique.mockResolvedValue({ ownerId: 5 });

      await expect(service.removeMember(10, 5, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });

    it('成員可以移除自己（離開看板）', async () => {
      authz.requireMember.mockResolvedValue({
        userId: 1,
        role: BoardRole.MEMBER,
      });
      prisma.board.findUnique.mockResolvedValue({ ownerId: 99 });
      prisma.boardMember.findUnique.mockResolvedValue({ userId: 1 });
      prisma.boardMember.delete.mockResolvedValue({});

      await expect(service.removeMember(10, 1, 1)).resolves.toBeUndefined();

      expect(authz.requireSelfOrAdmin).toHaveBeenCalledWith(
        1,
        { userId: 1, role: BoardRole.MEMBER },
        Permission.REMOVE_MEMBER,
        '您沒有權限移除此成員',
      );
      expect(prisma.boardMember.delete).toHaveBeenCalledWith({
        where: { boardId_userId: { boardId: 10, userId: 1 } },
      });
    });

    it('ADMIN 可以移除其他成員', async () => {
      prisma.board.findUnique.mockResolvedValue({ ownerId: 99 });
      prisma.boardMember.findUnique.mockResolvedValue({ userId: 5 });
      prisma.boardMember.delete.mockResolvedValue({});

      await expect(service.removeMember(10, 5, 1)).resolves.toBeUndefined();
      expect(prisma.boardMember.delete).toHaveBeenCalledWith({
        where: { boardId_userId: { boardId: 10, userId: 5 } },
      });
    });

    it('非本人的一般成員不能移除別人', async () => {
      authz.requireMember.mockResolvedValue({
        userId: 1,
        role: BoardRole.MEMBER,
      });
      prisma.board.findUnique.mockResolvedValue({ ownerId: 99 });
      authz.requireSelfOrAdmin.mockImplementation(() => {
        throw new ForbiddenException('您沒有權限移除此成員');
      });

      await expect(service.removeMember(10, 5, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.boardMember.findUnique).not.toHaveBeenCalled();
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });

    it('目標成員不存在時拋出 NotFoundException', async () => {
      prisma.board.findUnique.mockResolvedValue({ ownerId: 99 });
      prisma.boardMember.findUnique.mockResolvedValue(null);

      await expect(service.removeMember(10, 5, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });

    it('看板已封存時不查詢成員', async () => {
      boardsService.assertNotArchived.mockRejectedValue(
        new ForbiddenException('看板已封存'),
      );

      await expect(service.removeMember(10, 5, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.board.findUnique).not.toHaveBeenCalled();
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });
  });
});
