import { IsArray, IsInt, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** 單一欄位的排序資訊 */
class ColumnOrderItem {
  @IsInt()
  id!: number;

  @IsInt()
  @Type(() => Number)
  position!: number;
}

/**
 * 拖曳排序 API 的 Payload：一次傳入「所有欄位的新順序」。
 *
 * 業界標準做法：前端一次性傳入整個看板的欄位順序，
 * 而非只傳「哪兩個欄位交換」，這樣後端只需要一次 transaction 更新所有 position。
 *
 * 範例：[{ id: 3, position: 0 }, { id: 1, position: 1 }, { id: 2, position: 2 }]
 */
export class ReorderColumnsDto {
  @IsArray()
  @ArrayNotEmpty({ message: '排序清單不能為空' })
  @ValidateNested({ each: true })
  @Type(() => ColumnOrderItem)
  columns!: ColumnOrderItem[];
}
