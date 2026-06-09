import { IsHexColor, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLabelDto {
  @IsString()
  @IsNotEmpty({ message: '標籤名稱不能為空' })
  @MaxLength(50, { message: '標籤名稱不能超過 50 個字元' })
  name!: string;

  /**
   * Hex 色碼，例如 #FF5733。
   * 前端用於渲染標籤色塊；@IsHexColor 防止任意字串寫入 CSS 樣式。
   */
  @IsHexColor({ message: '標籤顏色必須是有效的 Hex 色碼，例如：#FF5733' })
  color!: string;
}
