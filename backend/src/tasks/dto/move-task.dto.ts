import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * 拖曳移動任務的 Payload。
 *
 * 設計決策：Move（換欄位）和 Reorder（同欄位調整順序）合用同一個 DTO。
 * - 只傳 position：同欄位排序
 * - 傳 targetColumnId + position：跨欄位移動
 */
export class MoveTaskDto {
  @IsOptional()
  @IsInt({ message: 'targetColumnId 必須是整數' })
  targetColumnId?: number;

  @IsInt({ message: 'position 必須是整數' })
  @Min(0, { message: 'position 不能為負數' })
  position!: number;
}
