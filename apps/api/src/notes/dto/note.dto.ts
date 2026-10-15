import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms.js';

export class CreateNoteDto {
  @ApiProperty({ example: '2차 면접은 시스템 디자인 위주라고 함' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '메모 내용을 입력해 주세요' })
  @MaxLength(5000)
  content!: string;
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
