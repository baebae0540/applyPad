import 'reflect-metadata';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  validateSync,
} from 'class-validator';

const DURATION = /^\d+[smhd]$/;

/** API가 사용하는 환경 변수. 앱 시작 시 검증하고, 빠진 값이 있으면 바로 실패시킨다. */
export class Env {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Type(() => Number)
  @IsInt()
  API_PORT: number = 4000;

  /** 웹 주소. CORS 허용과 로그인 후 리다이렉트에 사용 */
  @IsString()
  WEB_ORIGIN: string = 'http://localhost:3000';

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @Matches(DURATION, { message: 'JWT_ACCESS_TTL은 15m, 1h 같은 형식이어야 합니다' })
  JWT_ACCESS_TTL: string = '15m';

  @Matches(DURATION, { message: 'JWT_REFRESH_TTL은 14d 같은 형식이어야 합니다' })
  JWT_REFRESH_TTL: string = '14d';

  /** 운영(HTTPS)에서는 true. 로컬 http에서는 false여야 쿠키가 저장된다 */
  // enableImplicitConversion이 'false' 문자열을 true로 바꾸므로, 변환 전 원본 값(obj[key])으로 판단한다
  @Transform(({ obj, key }) => {
    const raw: unknown = (obj as Record<string, unknown>)[key];
    return raw === true || raw === 'true' || raw === '1';
  })
  @IsBoolean()
  COOKIE_SECURE: boolean = false;

  // Google OAuth. 비어 있으면 Google 로그인만 비활성화되고 나머지는 동작한다.
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  /** Google 콘솔에 등록한 리다이렉트 URI. 웹(/api 프록시)을 거치게 해서 쿠키가 웹 도메인에 저장되게 한다 */
  @IsString()
  GOOGLE_CALLBACK_URL: string = 'http://localhost:3000/api/auth/google/callback';
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`환경 변수 설정이 올바르지 않습니다:\n  ${detail}`);
  }
  return env;
}

/** '15m', '14d' 같은 기간 문자열을 밀리초로 변환 */
export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`잘못된 기간 형식: ${value}`);
  const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return Number(match[1]) * unit;
}
