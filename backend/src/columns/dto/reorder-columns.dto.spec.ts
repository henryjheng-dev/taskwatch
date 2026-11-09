import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReorderColumnsDto } from './reorder-columns.dto';

describe('ReorderColumnsDto', () => {
  it('position 為負數時驗證失敗', async () => {
    const dto = plainToInstance(ReorderColumnsDto, {
      columns: [{ id: 1, position: -1 }],
    });

    const errors = await validate(dto);
    const columnsError = errors.find((error) => error.property === 'columns');
    const positionError = columnsError?.children?.[0]?.children?.find(
      (error) => error.property === 'position',
    );

    expect(positionError).toBeDefined();
    expect(positionError?.constraints).toHaveProperty('min');
  });

  it('合法的排序 payload 驗證通過', async () => {
    const dto = plainToInstance(ReorderColumnsDto, {
      columns: [
        { id: 1, position: 0 },
        { id: 2, position: 1 },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('空陣列驗證失敗', async () => {
    const dto = plainToInstance(ReorderColumnsDto, { columns: [] });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'columns')).toBe(true);
  });
});
