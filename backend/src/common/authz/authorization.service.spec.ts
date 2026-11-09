import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { BoardRole } from '@/generated/prisma/client';
import { AuthorizationService } from './authorization.service';
import { Permission } from './permission.enum';
import { ROLE_PERMISSIONS } from './role-permissions';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const role = (value: 'ADMIN' | 'MEMBER' | 'GUEST') => value as BoardRole;

describe('AuthorizationService', () => {
  let prisma: {
    boardMember: {
      findUnique: jest.Mock;
    };
  };
  let service: AuthorizationService;

  beforeEach(() => {
    prisma = {
      boardMember: {
        findUnique: jest.fn(),
      },
    };
    service = new AuthorizationService(prisma as never);
  });

  describe('ROLE_PERMISSIONS', () => {
    it('GUEST 只有查看權限', () => {
      const permissions = ROLE_PERMISSIONS.GUEST;

      expect(permissions.size).toBe(2);
      expect(permissions.has(Permission.VIEW_BOARD)).toBe(true);
      expect(permissions.has(Permission.VIEW_MEMBERS)).toBe(true);
      expect(permissions.has(Permission.CREATE_TASK)).toBe(false);
      expect(permissions.has(Permission.UPDATE_TASK)).toBe(false);
      expect(permissions.has(Permission.DELETE_TASK)).toBe(false);
      expect(permissions.has(Permission.MOVE_TASK)).toBe(false);
    });

    it('MEMBER 可以協作，但不能管理看板、欄位與成員', () => {
      const permissions = ROLE_PERMISSIONS.MEMBER;

      expect(permissions.has(Permission.VIEW_BOARD)).toBe(true);
      expect(permissions.has(Permission.VIEW_MEMBERS)).toBe(true);
      expect(permissions.has(Permission.CREATE_COLUMN)).toBe(true);
      expect(permissions.has(Permission.CREATE_TASK)).toBe(true);
      expect(permissions.has(Permission.UPDATE_TASK)).toBe(true);
      expect(permissions.has(Permission.MOVE_TASK)).toBe(true);

      expect(permissions.has(Permission.UPDATE_BOARD)).toBe(false);
      expect(permissions.has(Permission.UPDATE_COLUMN)).toBe(false);
      expect(permissions.has(Permission.DELETE_COLUMN)).toBe(false);
      expect(permissions.has(Permission.REORDER_COLUMNS)).toBe(false);
      expect(permissions.has(Permission.ADD_MEMBER)).toBe(false);
      expect(permissions.has(Permission.UPDATE_MEMBER_ROLE)).toBe(false);
      expect(permissions.has(Permission.REMOVE_MEMBER)).toBe(false);
      expect(permissions.has(Permission.DELETE_TASK)).toBe(false);
    });

    it('ADMIN 擁有所有權限', () => {
      const allPermissions = Object.values(Permission);

      expect(ROLE_PERMISSIONS.ADMIN.size).toBe(allPermissions.length);
      for (const permission of allPermissions) {
        expect(ROLE_PERMISSIONS.ADMIN.has(permission)).toBe(true);
      }
    });
  });

  describe('findMember', () => {
    it('以 boardId + userId 複合鍵查詢成員', async () => {
      const member = { userId: 7, role: role('MEMBER') };
      prisma.boardMember.findUnique.mockResolvedValue(member);

      await expect(service.findMember(3, 7)).resolves.toEqual(member);
      expect(prisma.boardMember.findUnique).toHaveBeenCalledWith({
        where: { boardId_userId: { boardId: 3, userId: 7 } },
        select: { userId: true, role: true },
      });
    });

    it('找不到成員時回傳 null', async () => {
      prisma.boardMember.findUnique.mockResolvedValue(null);

      await expect(service.findMember(3, 7)).resolves.toBeNull();
    });
  });

  describe('requireMember', () => {
    it('是成員時回傳成員身分', async () => {
      const member = { userId: 7, role: role('MEMBER') };
      prisma.boardMember.findUnique.mockResolvedValue(member);

      await expect(service.requireMember(3, 7)).resolves.toEqual(member);
    });

    it('非成員時拋出 NotFoundException', async () => {
      prisma.boardMember.findUnique.mockResolvedValue(null);

      await expect(service.requireMember(3, 7)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('requirePermission', () => {
    it('角色擁有權限時回傳成員身分', async () => {
      const member = { userId: 7, role: role('MEMBER') };
      prisma.boardMember.findUnique.mockResolvedValue(member);

      await expect(
        service.requirePermission(7, 3, Permission.CREATE_TASK),
      ).resolves.toEqual(member);
    });

    it('角色沒有權限時拋出 ForbiddenException', async () => {
      prisma.boardMember.findUnique.mockResolvedValue({
        userId: 7,
        role: role('MEMBER'),
      });

      await expect(
        service.requirePermission(7, 3, Permission.UPDATE_BOARD),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('非成員時拋出 NotFoundException，而不是 ForbiddenException', async () => {
      prisma.boardMember.findUnique.mockResolvedValue(null);

      await expect(
        service.requirePermission(7, 3, Permission.CREATE_TASK),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireOwner', () => {
    it('owner 可以通過', () => {
      expect(() => service.requireOwner({ ownerId: 1 }, 1)).not.toThrow();
    });

    it('非 owner 會拋出 ForbiddenException', () => {
      expect(() => service.requireOwner({ ownerId: 1 }, 2)).toThrow(
        ForbiddenException,
      );
    });

    it('可以自訂錯誤訊息', () => {
      expect(() =>
        service.requireOwner({ ownerId: 1 }, 2, '只有擁有者可以刪除'),
      ).toThrow('只有擁有者可以刪除');
    });
  });

  describe('requireCreatorOrAdmin', () => {
    it('任務建立者即使是 MEMBER 也可以通過', () => {
      expect(() =>
        service.requireCreatorOrAdmin(
          { createdBy: 7 },
          { userId: 7, role: role('MEMBER') },
          Permission.DELETE_TASK,
        ),
      ).not.toThrow();
    });

    it('ADMIN 可以操作其他人建立的任務', () => {
      expect(() =>
        service.requireCreatorOrAdmin(
          { createdBy: 7 },
          { userId: 1, role: role('ADMIN') },
          Permission.DELETE_TASK,
        ),
      ).not.toThrow();
    });

    it('非建立者的 MEMBER 會拋出 ForbiddenException', () => {
      expect(() =>
        service.requireCreatorOrAdmin(
          { createdBy: 7 },
          { userId: 1, role: role('MEMBER') },
          Permission.DELETE_TASK,
        ),
      ).toThrow(ForbiddenException);
    });

    it('GUEST 不是建立者時會拋出 ForbiddenException', () => {
      expect(() =>
        service.requireCreatorOrAdmin(
          { createdBy: 7 },
          { userId: 1, role: role('GUEST') },
          Permission.DELETE_TASK,
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('requireSelfOrAdmin', () => {
    it('本人可以通過', () => {
      expect(() =>
        service.requireSelfOrAdmin(
          7,
          { userId: 7, role: role('MEMBER') },
          Permission.REMOVE_MEMBER,
        ),
      ).not.toThrow();
    });

    it('ADMIN 可以操作其他成員', () => {
      expect(() =>
        service.requireSelfOrAdmin(
          7,
          { userId: 1, role: role('ADMIN') },
          Permission.REMOVE_MEMBER,
        ),
      ).not.toThrow();
    });

    it('非本人的 MEMBER 會拋出 ForbiddenException', () => {
      expect(() =>
        service.requireSelfOrAdmin(
          7,
          { userId: 1, role: role('MEMBER') },
          Permission.REMOVE_MEMBER,
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
