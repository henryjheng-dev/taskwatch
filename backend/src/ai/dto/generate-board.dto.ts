import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class GenerateBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  prompt!: string;
}
