import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './auth.constants.js';

/** 로그인 없이 접근 가능한 라우트 (기본값은 모든 라우트가 인증 필요) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export type AuthUser = { id: string };

/** JwtAuthGuard가 검증한 현재 사용자 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user,
);
