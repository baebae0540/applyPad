import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimToNull } from '../../common/transforms.js';
import { InterviewResult, InterviewType } from '../../generated/prisma/enums.js';

export class CreateInterviewDto {
  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-21T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: '면접 일시가 올바르지 않습니다' })
  scheduledAt!: Date;

  @ApiPropertyOptional({ enum: InterviewType, default: InterviewType.OTHER })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;

  @ApiPropertyOptional({ example: '강남역 10번 출구', nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @ApiPropertyOptional({ enum: InterviewResult, default: InterviewResult.PENDING })
  @IsOptional()
  @IsEnum(InterviewResult)
  result?: InterviewResult;

  @ApiPropertyOptional({ example: '1차 기술 면접, 코드 리뷰 위주', nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(2000)
  memo?: string | null;
}

export class UpdateInterviewDto extends PartialType(CreateInterviewDto) {}
