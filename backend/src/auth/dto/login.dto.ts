import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Email 不能為空' })
  @IsEmail({}, { message: '請輸入正確的 Email 格式' })
  email!: string;

  @IsString()
  @MinLength(8, { message: '密碼長度至少需要 8 個字' })
  @MaxLength(72, { message: '密碼長度最多不可超過 72 個字' })
  password!: string;
}
