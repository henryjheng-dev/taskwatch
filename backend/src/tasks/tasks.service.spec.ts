import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Permission } from '../common/authz/permission.enum';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../boards/boards.service', () => ({
  BoardsService: class BoardsService {},
}));

jest.mock('../columns/columns.service', () => ({
  ColumnsService: class ColumnsService {},
}));

describe('TasksService', () => {
  let prisma: any;
  let authz: any;
  let boardsService: any;
  let columnsService: any;
  let service: TasksService;

  const task = {
    id: 100,
    createdBy: 7,
    columnId: 20,
    column: { boardId: 10 },
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      task: {
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    authz = {
      requirePermission: jest.fn(),
      requireMember: jest.fn(),
      requireCreatorOrAdmin: jest.fn(),
    };
    boardsService = {
      assertNotArchived: jest.fn(),
    };
    columnsService = {
      assertColumnBelongsToBoard: jest.fn(),
    };

    authz.requirePermission.mockResolvedValue({
      userId: 1,
      role: 'MEMBER',
    });
    authz.requireMember.mockResolvedValue({
      userId: 1,
      role: 'MEMBER',
    });
    authz.requireCreatorOrAdmin.mockReturnValue(undefined);
    boardsService.assertNotArchived.mockResolvedValue(undefined);
    columnsService.assertColumnBelongsToBoard.mockResolvedValue({
      id: 20,
      boardId: 10,
    });

    service = new TasksService(
      prisma as never,
      boardsService as never,
      columnsService as never,
      authz as never,
    );
  });

  describe('create', () => {
    it('未指定 position 時使用同欄位任務數量', async () => {
      prisma.task.count.mockResolvedValue(3);
      prisma.task.create.mockResolvedValue({ id: 100 });

      await expect(
        service.create(10, 20, 1, { title: 'Task' }),
      ).resolves.toEqual({ id: 100 });

      expect(authz.requirePermission).toHaveBeenCalledWith(
        1,
        10,
        Permission.CREATE_TASK,
      );
      expect(boardsService.assertNotArchived).toHaveBeenCalledWith(10);
      expect(columnsService.assertColumnBelongsToBoard).toHaveBeenCalledWith(
        20,
        10,
      );
      expect(prisma.task.count).toHaveBeenCalledWith({
        where: { columnId: 20 },
      });
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          columnId: 20,
          createdBy: 1,
          title: 'Task',
          description: undefined,
          priority: undefined,
          dueDate: undefined,
          position: 3,
        },
      });
    });

    it('有指定 position 時不查詢任務數量', async () => {
      prisma.task.create.mockResolvedValue({ id: 100 });

      await service.create(10, 20, 1, { title: 'Task', position: 0 });

      expect(prisma.task.count).not.toHaveBeenCalled();
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 0 }),
        }),
      );
    });

    it('dueDate 會轉成 Date', async () => {
      prisma.task.count.mockResolvedValue(0);
      prisma.task.create.mockResolvedValue({ id: 100 });

      await service.create(10, 20, 1, {
        title: 'Task',
        dueDate: '2026-11-09',
      });

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: new Date('2026-11-09'),
          }),
        }),
      );
    });

    it('沒有 CREATE_TASK 權限時不建立任務', async () => {
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(
        service.create(10, 20, 1, { title: 'Task' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(boardsService.assertNotArchived).not.toHaveBeenCalled();
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('欄位不屬於看板時不建立任務', async () => {
      columnsService.assertColumnBelongsToBoard.mockRejectedValue(
        new NotFoundException('欄位不存在'),
      );

      await expect(
        service.create(10, 20, 1, { title: 'Task' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('更新任務內容並轉換 dueDate', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue({ id: 100 });

      await expect(
        service.update(100, 1, {
          title: 'Updated',
          dueDate: '2026-12-01',
        }),
      ).resolves.toEqual({ id: 100 });

      expect(authz.requirePermission).toHaveBeenCalledWith(
        1,
        10,
        Permission.UPDATE_TASK,
      );
      expect(boardsService.assertNotArchived).toHaveBeenCalledWith(10);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: {
          title: 'Updated',
          dueDate: new Date('2026-12-01'),
        },
      });
    });

    it('dueDate 為 null 時保留 null', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue({ id: 100 });

      await service.update(100, 1, { dueDate: null as never });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { dueDate: null },
      });
    });

    it('未提供 dueDate 時不寫入 dueDate', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue({ id: 100 });

      await service.update(100, 1, { title: 'Updated' });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { title: 'Updated', dueDate: undefined },
      });
    });

    it('任務不存在時拋出 NotFoundException，且不檢查權限', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.update(999, 1, { title: 'Updated' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(authz.requirePermission).not.toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('沒有 UPDATE_TASK 權限時不更新任務', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(
        service.update(100, 1, { title: 'Updated' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('任務建立者可以刪除自己的任務', async () => {
      const creatorTask = { ...task, createdBy: 1 };
      prisma.task.findUnique.mockResolvedValue(creatorTask);
      prisma.task.delete.mockResolvedValue({});

      await expect(service.remove(100, 1)).resolves.toBeUndefined();

      expect(authz.requireMember).toHaveBeenCalledWith(10, 1);
      expect(authz.requireCreatorOrAdmin).toHaveBeenCalledWith(
        creatorTask,
        { userId: 1, role: 'MEMBER' },
        Permission.DELETE_TASK,
        '只有 ADMIN 或任務建立者才能刪除任務',
      );
      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: 100 },
      });
    });

    it('非建立者的一般成員不能刪除任務', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      authz.requireCreatorOrAdmin.mockImplementation(() => {
        throw new ForbiddenException('只有 ADMIN 或任務建立者才能刪除任務');
      });

      await expect(service.remove(100, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('ADMIN 可以刪除其他人建立的任務', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      authz.requireMember.mockResolvedValue({
        userId: 1,
        role: 'ADMIN',
      });
      prisma.task.delete.mockResolvedValue({});

      await expect(service.remove(100, 1)).resolves.toBeUndefined();

      expect(authz.requireCreatorOrAdmin).toHaveBeenCalledWith(
        task,
        { userId: 1, role: 'ADMIN' },
        Permission.DELETE_TASK,
        '只有 ADMIN 或任務建立者才能刪除任務',
      );
      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: 100 },
      });
    });

    it('看板已封存時不刪除任務', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      boardsService.assertNotArchived.mockRejectedValue(
        new ForbiddenException('看板已封存'),
      );

      await expect(service.remove(100, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(authz.requireCreatorOrAdmin).not.toHaveBeenCalled();
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('非看板成員不能刪除任務', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      authz.requireMember.mockRejectedValue(
        new NotFoundException('看板不存在或您不是成員'),
      );

      await expect(service.remove(100, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(boardsService.assertNotArchived).not.toHaveBeenCalled();
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });
  });

  describe('move', () => {
    it('未指定 targetColumnId 時只更新同欄位的 position', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue({ id: 100 });

      await expect(
        service.move(100, 1, { position: 2 }),
      ).resolves.toEqual({ id: 100 });

      expect(authz.requirePermission).toHaveBeenCalledWith(
        1,
        10,
        Permission.MOVE_TASK,
      );
      expect(columnsService.assertColumnBelongsToBoard).not.toHaveBeenCalled();
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { columnId: 20, position: 2 },
      });
    });

    it('targetColumnId 與目前欄位相同時不重複驗證欄位', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue({ id: 100 });

      await service.move(100, 1, { targetColumnId: 20, position: 0 });

      expect(columnsService.assertColumnBelongsToBoard).not.toHaveBeenCalled();
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { columnId: 20, position: 0 },
      });
    });

    it('移動到不同欄位時先驗證目標欄位屬於同一看板', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue({ id: 100 });

      await service.move(100, 1, { targetColumnId: 21, position: 0 });

      expect(columnsService.assertColumnBelongsToBoard).toHaveBeenCalledWith(
        21,
        10,
      );
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { columnId: 21, position: 0 },
      });
    });

    it('targetColumnId 為 0 時仍會驗證欄位，不會直接更新', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      columnsService.assertColumnBelongsToBoard.mockRejectedValue(
        new NotFoundException('欄位不存在'),
      );

      await expect(
        service.move(100, 1, { targetColumnId: 0, position: 0 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(columnsService.assertColumnBelongsToBoard).toHaveBeenCalledWith(
        0,
        10,
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('目標欄位不屬於同一看板時不更新任務', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      columnsService.assertColumnBelongsToBoard.mockRejectedValue(
        new NotFoundException('欄位不存在'),
      );

      await expect(
        service.move(100, 1, { targetColumnId: 99, position: 0 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('沒有 MOVE_TASK 權限時不更新任務', async () => {
      prisma.task.findUnique.mockResolvedValue(task);
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(
        service.move(100, 1, { targetColumnId: 21, position: 0 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(columnsService.assertColumnBelongsToBoard).not.toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('任務不存在時拋出 NotFoundException', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.move(999, 1, { targetColumnId: 21, position: 0 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(authz.requirePermission).not.toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });
});
