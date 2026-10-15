import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignupDto {
  @ApiProperty({ example: 'me@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'correct-horse-battery' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다' })
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: '전상배' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'me@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다' })
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: String }) avatarUrl!: string | null;
  @ApiProperty() hasPassword!: boolean;
  @ApiProperty({ type: [String], example: ['google'] }) providers!: string[];
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Authorization: Bearer 헤더에 넣는 access 토큰' })
  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
