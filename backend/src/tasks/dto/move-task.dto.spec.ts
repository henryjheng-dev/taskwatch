import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MoveTaskDto } from './move-task.dto';

describe('MoveTaskDto', () => {
  it('targetColumnId 為 0 時驗證失敗', async () => {
    const dto = plainToInstance(MoveTaskDto, {
      targetColumnId: 0,
      position: 0,
    });

    const errors = await validate(dto);

    const targetColumnError = errors.find(
      (error) => error.property === 'targetColumnId',
    );
    expect(targetColumnError).toBeDefined();
    expect(targetColumnError?.constraints).toHaveProperty('min');
  });

  it('合法的 targetColumnId 與 position 驗證通過', async () => {
    const dto = plainToInstance(MoveTaskDto, {
      targetColumnId: 21,
      position: 0,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('未指定 targetColumnId 時仍可只調整 position', async () => {
    const dto = plainToInstance(MoveTaskDto, { position: 2 });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
