import { IsInt } from 'class-validator';

export class AddAssigneeDto {
  @IsInt({ message: 'userId 必須是整數' })
  userId!: number;
}
