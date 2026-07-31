import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BoardRole } from '@/generated/prisma/client';

export class AddMemberDto {
  /**
   * 可用名稱或 Email 邀請，
   * Service 會先比對 name，再比對 email。
   */
  @IsString()
  @IsNotEmpty({ message: '請輸入名稱或 Email' })
  query!: string;

  /**
   * 未填時 Service 預設指派 MEMBER 角色。
   * 使用 Prisma 產生的 enum 確保型別與 DB 定義完全一致。
   */
  @IsOptional()
  @IsEnum(BoardRole, { message: '角色必須是 ADMIN、MEMBER 或 GUEST' })
  role?: BoardRole;
}
