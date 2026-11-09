import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { Permission } from '../common/authz/permission.enum';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../boards/boards.service', () => ({
  BoardsService: class BoardsService {},
}));

describe('ColumnsService', () => {
  let prisma: any;
  let tx: any;
  let authz: any;
  let boardsService: any;
  let service: ColumnsService;

  beforeEach(() => {
    jest.resetAllMocks();

    tx = {
      column: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    prisma = {
      column: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    authz = {
      requirePermission: jest.fn(),
    };
    boardsService = {
      assertNotArchived: jest.fn(),
    };

    authz.requirePermission.mockResolvedValue({
      userId: 1,
      role: 'ADMIN',
    });
    boardsService.assertNotArchived.mockResolvedValue(undefined);

    service = new ColumnsService(
      prisma as never,
      boardsService as never,
      authz as never,
    );
  });

  describe('create', () => {
    it('未指定 position 時使用最大 position + 1', async () => {
      prisma.column.aggregate.mockResolvedValue({
        _max: { position: 5 },
      });
      prisma.column.create.mockResolvedValue({ id: 30, position: 6 });

      await expect(
        service.create(10, 1, { name: 'Done' }),
      ).resolves.toEqual({ id: 30, position: 6 });

      expect(authz.requirePermission).toHaveBeenCalledWith(
        1,
        10,
        Permission.CREATE_COLUMN,
      );
      expect(boardsService.assertNotArchived).toHaveBeenCalledWith(10);
      expect(prisma.column.aggregate).toHaveBeenCalledWith({
        where: { boardId: 10 },
        _max: { position: true },
      });
      expect(prisma.column.create).toHaveBeenCalledWith({
        data: { boardId: 10, name: 'Done', position: 6 },
      });
    });

    it('看板沒有欄位時 position 從 0 開始', async () => {
      prisma.column.aggregate.mockResolvedValue({
        _max: { position: null },
      });
      prisma.column.create.mockResolvedValue({ id: 30, position: 0 });

      await service.create(10, 1, { name: 'Todo' });

      expect(prisma.column.create).toHaveBeenCalledWith({
        data: { boardId: 10, name: 'Todo', position: 0 },
      });
    });

    it('有指定 position 時不查詢最大 position', async () => {
      prisma.column.create.mockResolvedValue({ id: 30, position: 0 });

      await service.create(10, 1, { name: 'Todo', position: 0 });

      expect(prisma.column.aggregate).not.toHaveBeenCalled();
      expect(prisma.column.create).toHaveBeenCalledWith({
        data: { boardId: 10, name: 'Todo', position: 0 },
      });
    });

    it('沒有 CREATE_COLUMN 權限時不建立欄位', async () => {
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(service.create(10, 1, { name: 'Todo' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(boardsService.assertNotArchived).not.toHaveBeenCalled();
      expect(prisma.column.create).not.toHaveBeenCalled();
    });

    it('看板已封存時不建立欄位', async () => {
      boardsService.assertNotArchived.mockRejectedValue(
        new ForbiddenException('看板已封存'),
      );

      await expect(service.create(10, 1, { name: 'Todo' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.column.aggregate).not.toHaveBeenCalled();
      expect(prisma.column.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('確認權限、封存狀態與欄位歸屬後更新', async () => {
      prisma.column.findFirst.mockResolvedValue({ id: 30, boardId: 10 });
      prisma.column.update.mockResolvedValue({ id: 30, name: 'Doing' });

      await expect(
        service.update(10, 30, 1, { name: 'Doing' }),
      ).resolves.toEqual({ id: 30, name: 'Doing' });

      expect(authz.requirePermission).toHaveBeenCalledWith(
        1,
        10,
        Permission.UPDATE_COLUMN,
      );
      expect(boardsService.assertNotArchived).toHaveBeenCalledWith(10);
      expect(prisma.column.findFirst).toHaveBeenCalledWith({
        where: { id: 30, boardId: 10 },
      });
      expect(prisma.column.update).toHaveBeenCalledWith({
        where: { id: 30 },
        data: { name: 'Doing' },
      });
    });

    it('沒有 UPDATE_COLUMN 權限時不更新欄位', async () => {
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(
        service.update(10, 30, 1, { name: 'Doing' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.column.update).not.toHaveBeenCalled();
    });

    it('看板已封存時不更新欄位', async () => {
      boardsService.assertNotArchived.mockRejectedValue(
        new ForbiddenException('看板已封存'),
      );

      await expect(
        service.update(10, 30, 1, { name: 'Doing' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.column.findFirst).not.toHaveBeenCalled();
      expect(prisma.column.update).not.toHaveBeenCalled();
    });

    it('欄位屬於其他看板時拋出 NotFoundException，且不更新', async () => {
      prisma.column.findFirst.mockResolvedValue(null);

      await expect(
        service.update(10, 30, 1, { name: 'Doing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.column.update).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    it('payload 有重複 id 時拋出 BadRequestException，且不更新任何欄位', async () => {
      tx.column.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await expect(
        service.reorder(10, 1, {
          columns: [
            { id: 1, position: 0 },
            { id: 1, position: 1 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.column.update).not.toHaveBeenCalled();
    });

    it('payload 缺少看板欄位時拋出 BadRequestException', async () => {
      tx.column.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

      await expect(
        service.reorder(10, 1, {
          columns: [
            { id: 1, position: 0 },
            { id: 2, position: 1 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.column.update).not.toHaveBeenCalled();
    });

    it('payload 包含其他看板的欄位 id 時拋出 NotFoundException', async () => {
      tx.column.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await expect(
        service.reorder(10, 1, {
          columns: [
            { id: 1, position: 0 },
            { id: 99, position: 1 },
          ],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.column.update).not.toHaveBeenCalled();
    });

    it('合法 payload 在交易內更新所有 position', async () => {
      tx.column.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
      tx.column.update.mockResolvedValue({});

      await expect(
        service.reorder(10, 1, {
          columns: [
            { id: 3, position: 0 },
            { id: 1, position: 1 },
            { id: 2, position: 2 },
          ],
        }),
      ).resolves.toBeUndefined();

      expect(authz.requirePermission).toHaveBeenCalledWith(
        1,
        10,
        Permission.REORDER_COLUMNS,
      );
      expect(boardsService.assertNotArchived).toHaveBeenCalledWith(10);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.column.findMany).toHaveBeenCalledWith({
        where: { boardId: 10 },
        select: { id: true },
      });
      expect(tx.column.update).toHaveBeenCalledTimes(3);
      expect(tx.column.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { position: 0 },
      });
      expect(tx.column.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { position: 1 },
      });
      expect(tx.column.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { position: 2 },
      });
    });

    it('沒有 REORDER_COLUMNS 權限時不開啟交易', async () => {
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(
        service.reorder(10, 1, { columns: [{ id: 1, position: 0 }] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(boardsService.assertNotArchived).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('看板已封存時不開啟交易', async () => {
      boardsService.assertNotArchived.mockRejectedValue(
        new ForbiddenException('看板已封存'),
      );

      await expect(
        service.reorder(10, 1, { columns: [{ id: 1, position: 0 }] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('確認權限、封存狀態與欄位歸屬後刪除', async () => {
      prisma.column.findFirst.mockResolvedValue({ id: 30, boardId: 10 });
      prisma.column.delete.mockResolvedValue({});

      await expect(service.remove(10, 30, 1)).resolves.toBeUndefined();

      expect(authz.requirePermission).toHaveBeenCalledWith(
        1,
        10,
        Permission.DELETE_COLUMN,
      );
      expect(boardsService.assertNotArchived).toHaveBeenCalledWith(10);
      expect(prisma.column.findFirst).toHaveBeenCalledWith({
        where: { id: 30, boardId: 10 },
      });
      expect(prisma.column.delete).toHaveBeenCalledWith({
        where: { id: 30 },
      });
    });

    it('沒有 DELETE_COLUMN 權限時不刪除欄位', async () => {
      authz.requirePermission.mockRejectedValue(
        new ForbiddenException('沒有權限'),
      );

      await expect(service.remove(10, 30, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.column.delete).not.toHaveBeenCalled();
    });

    it('看板已封存時不刪除欄位', async () => {
      boardsService.assertNotArchived.mockRejectedValue(
        new ForbiddenException('看板已封存'),
      );

      await expect(service.remove(10, 30, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.column.findFirst).not.toHaveBeenCalled();
      expect(prisma.column.delete).not.toHaveBeenCalled();
    });

    it('欄位屬於其他看板時拋出 NotFoundException，且不刪除', async () => {
      prisma.column.findFirst.mockResolvedValue(null);

      await expect(service.remove(10, 30, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.column.delete).not.toHaveBeenCalled();
    });
  });

  describe('assertColumnBelongsToBoard', () => {
    it('欄位屬於看板時回傳欄位', async () => {
      const column = { id: 30, boardId: 10 };
      prisma.column.findFirst.mockResolvedValue(column);

      await expect(service.assertColumnBelongsToBoard(30, 10)).resolves.toEqual(
        column,
      );
      expect(prisma.column.findFirst).toHaveBeenCalledWith({
        where: { id: 30, boardId: 10 },
      });
    });

    it('欄位不存在或不屬於看板時拋出 NotFoundException', async () => {
      prisma.column.findFirst.mockResolvedValue(null);

      await expect(
        service.assertColumnBelongsToBoard(30, 10),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
