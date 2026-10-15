import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { emptyToNull, trim } from '../../common/transforms.js';
import { ApplicationStatus } from '../../generated/prisma/enums.js';

export class CreateApplicationDto {
  @ApiProperty({ example: '토스' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '회사명을 입력해 주세요' })
  @MaxLength(100)
  companyName!: string;

  @ApiProperty({ example: '백엔드 개발자' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '직무를 입력해 주세요' })
  @MaxLength(100)
  position!: string;

  @ApiPropertyOptional({ enum: ApplicationStatus, default: ApplicationStatus.INTERESTED })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ example: 'https://example.com/jobs/123', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ require_protocol: true }, { message: '공고 URL은 http(s)://로 시작해야 합니다' })
  @MaxLength(2000)
  jobUrl?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  appliedAt?: Date | null;

  @ApiPropertyOptional({ example: '희망 6,000 / 현재 협의', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  salaryNote?: string | null;
}

/** 상태와 순서는 /move 로만 바꾼다 (이력 기록을 한 곳에서 하기 위해) */
export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {}

export class MoveApplicationDto {
  @ApiProperty({ enum: ApplicationStatus, description: '옮길 칸반 컬럼' })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @ApiProperty({ example: 0, description: '컬럼 안에서의 위치 (0부터). 범위를 넘으면 맨 끝' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index!: number;
}

export class ListApplicationsQuery {
  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ description: '회사명·직무 검색어' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: '태그 ID로 필터' })
  @IsOptional()
  @IsString()
  tagId?: string;
}
