import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty({ message: '看板名稱不能為空' })
  @MaxLength(100, { message: '看板名稱不能超過 100 個字元' })
  name!: string;

  /**
   * 選填。Hex 色碼格式（#RRGGBB）。
   * 未提供時 Prisma schema 會套用預設值 #0079BF（Trello 經典藍）。
   */
  @IsOptional()
  @IsHexColor({ message: '背景顏色必須是有效的 Hex 色碼，例如：#0079BF' })
  backgroundColor?: string;
}
