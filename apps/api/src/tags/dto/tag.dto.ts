import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trim, trimToNull } from '../../common/transforms.js';

export class CreateTagDto {
  @ApiProperty({ example: '원격근무' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '태그 이름을 입력해 주세요' })
  @MaxLength(30)
  name!: string;

  @ApiPropertyOptional({ example: '#2f5d50', nullable: true, description: '#RRGGBB' })
  @IsOptional()
  @Transform(trimToNull)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: '색은 #RRGGBB 형식이어야 합니다' })
  color?: string | null;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}

export class SetApplicationTagsDto {
  @ApiProperty({ type: [String], description: '이 지원에 붙일 태그 ID 전체 (없으면 빈 배열)' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tagIds!: string[];
}
