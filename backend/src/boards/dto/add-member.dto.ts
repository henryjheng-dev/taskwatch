import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { BoardRole } from '@/generated/prisma/client';

export class AddMemberDto {
  /**
   * 用 Email 邀請而非 userId，
   * 前端不需要知道對方的 DB 主鍵，符合 API 資安最佳實踐。
   */
  @IsEmail({}, { message: '請輸入有效的 Email 地址' })
  @IsNotEmpty({ message: 'Email 不能為空' })
  email!: string;

  /**
   * 未填時 Service 預設指派 MEMBER 角色。
   * 使用 Prisma 產生的 enum 確保型別與 DB 定義完全一致。
   */
  @IsOptional()
  @IsEnum(BoardRole, { message: '角色必須是 ADMIN、MEMBER 或 GUEST' })
  role?: BoardRole;
}
