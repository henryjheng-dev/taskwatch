import { PartialType } from '@nestjs/mapped-types';
import { CreateBoardDto } from './create-board.dto';

/**
 * UpdateBoardDto 繼承 CreateBoardDto 的所有欄位，
 * 並透過 PartialType 將它們全部設為「選填」。
 *
 * 這是 NestJS 官方推薦的 PATCH 語意 DTO 寫法：
 * 只需傳入「想更新的欄位」，原本驗證規則（MaxLength 等）依然生效。
 */
export class UpdateBoardDto extends PartialType(CreateBoardDto) {}
