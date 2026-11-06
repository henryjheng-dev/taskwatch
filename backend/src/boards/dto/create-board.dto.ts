import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty({ message: '看板名稱不能為空' })
  @MaxLength(100, { message: '看板名稱不能超過 100 個字元' })
  name!: string;
}
