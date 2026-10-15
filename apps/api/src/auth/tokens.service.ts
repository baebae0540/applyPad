import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { durationToMs, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REFRESH_REUSE_GRACE_MS } from './auth.constants.js';

export type IssuedRefresh = { token: string; expiresAt: Date };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * access 토큰: 짧게 사는 JWT (응답 본문으로 전달, 프론트는 메모리에만 보관)
 * refresh 토큰: 랜덤 불투명 문자열. DB에는 SHA-256 해시만 저장하고, 쓸 때마다 새로 발급(회전)한다.
 */
@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTtlMs = durationToMs(config.get('JWT_REFRESH_TTL', { infer: true }));
  }

  signAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId });
  }

  async issueRefreshToken(userId: string): Promise<IssuedRefresh> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt },
    });
    return { token, expiresAt };
  }

  /** refresh 토큰을 검증하고 회전한다. 성공하면 userId와 새 refresh 토큰을 돌려준다. */
  async rotate(token: string): Promise<{ userId: string; refresh: IssuedRefresh }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record) {
      throw new UnauthorizedException('세션이 만료되었습니다. 다시 로그인해 주세요');
    }

    if (record.revokedAt) {
      const sinceRevoked = Date.now() - record.revokedAt.getTime();
      if (sinceRevoked > REFRESH_REUSE_GRACE_MS) {
        // 이미 회전된 토큰이 한참 뒤에 다시 쓰였다 → 탈취 가능성. 해당 사용자의 모든 세션을 끊는다.
        await this.revokeAllForUser(record.userId);
        this.logger.warn(`refresh token reuse detected for user ${record.userId}`);
      }
      throw new UnauthorizedException('세션이 만료되었습니다. 다시 로그인해 주세요');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('세션이 만료되었습니다. 다시 로그인해 주세요');
    }

    // 조건부 업데이트로 동시에 들어온 요청 중 하나만 회전에 성공하게 한다
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count !== 1) {
      throw new UnauthorizedException('세션이 만료되었습니다. 다시 로그인해 주세요');
    }

    const refresh = await this.issueRefreshToken(record.userId);
    return { userId: record.userId, refresh };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
