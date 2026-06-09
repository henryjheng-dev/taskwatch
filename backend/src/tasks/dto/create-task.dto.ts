import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { Priority } from '@/generated/prisma/client';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: '任務標題不能為空' })
  @MaxLength(255, { message: '任務標題不能超過 255 個字元' })
  title!: string;

  /**
   * Markdown 格式的任務描述，後端不轉義、原文儲存。
   * 前端渲染時必須使用安全的 Markdown parser（如 DOMPurify），防止 XSS。
   */
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * 任務連結，使用 @IsUrl() 限制格式，防止 javascript: 協議注入。
   */
  @IsOptional()
  @IsUrl({}, { message: '連結格式不正確' })
  @MaxLength(2048, { message: '連結長度不能超過 2048 個字元' })
  linkUrl?: string;

  @IsOptional()
  @IsEnum(Priority, { message: '優先級必須是 LOW、MEDIUM 或 HIGH' })
  priority?: Priority;

  /**
   * ISO 8601 日期字串，例如 "2024-12-31"。
   * @IsDateString() 驗證格式，Service 存入 DB 時轉為 Date 物件。
   */
  @IsOptional()
  @IsDateString({}, { message: '截止日期格式不正確，請使用 YYYY-MM-DD' })
  dueDate?: string;

  @IsOptional()
  @IsInt({ message: 'position 必須是整數' })
  @Min(0, { message: 'position 不能為負數' })
  position?: number;
}
