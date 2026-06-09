import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateColumnDto {
  @IsString()
  @IsNotEmpty({ message: '欄位名稱不能為空' })
  @MaxLength(100, { message: '欄位名稱不能超過 100 個字元' })
  name!: string;

  /**
   * 排列順序，選填，未提供時 Service 自動計算（放到最後）。
   * position 由前端以 0-based 索引管理，後端不強制連續。
   */
  @IsOptional()
  @IsInt({ message: 'position 必須是整數' })
  @Min(0, { message: 'position 不能為負數' })
  position?: number;
}
