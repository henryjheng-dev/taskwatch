import { IsEnum, IsNotEmpty } from 'class-validator';
import { BoardRole } from '@/generated/prisma/client';

export class UpdateMemberRoleDto {
  /**
   * 必填：明確指定要更改的目標角色。
   * PATCH 語意下不允許「不傳角色」，因為那代表什麼都不想改。
   */
  @IsNotEmpty({ message: '角色不能為空' })
  @IsEnum(BoardRole, { message: '角色必須是 ADMIN、MEMBER 或 GUEST' })
  role!: BoardRole;
}
