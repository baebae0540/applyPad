import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

/** OAuth 진행 중 쿠키에 보관하는 값 (서명된 쿠키가 아니라 httpOnly 쿠키 + state 비교로 위조를 막는다) */
export type OAuthPending = { state: string; verifier: string; redirect: string };

export class GoogleOAuthError extends Error {}

/**
 * Google OAuth 2.0 Authorization Code 흐름 (state로 CSRF 방지 + PKCE).
 * 토큰 교환은 서버 간 통신으로만 하고, 프로필은 OIDC userinfo 엔드포인트에서 가져온다.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return Boolean(
      this.config.get('GOOGLE_CLIENT_ID', { infer: true }) &&
        this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
    );
  }

  /** 로그인 시작: Google 동의 화면 URL과 쿠키에 저장할 값을 만든다 */
  createAuthorization(redirect: string): { url: string; pending: OAuthPending } {
    const state = randomBytes(16).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: this.config.get('GOOGLE_CLIENT_ID', { infer: true })!,
      redirect_uri: this.config.get('GOOGLE_CALLBACK_URL', { infer: true }),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();

    return { url: url.toString(), pending: { state, verifier, redirect } };
  }

  /** 콜백: code를 토큰으로 교환하고 사용자 프로필을 가져온다 */
  async fetchProfile(code: string, verifier: string): Promise<GoogleProfile> {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: verifier,
        client_id: this.config.get('GOOGLE_CLIENT_ID', { infer: true })!,
        client_secret: this.config.get('GOOGLE_CLIENT_SECRET', { infer: true })!,
        redirect_uri: this.config.get('GOOGLE_CALLBACK_URL', { infer: true }),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      this.logger.warn(`Google token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
      throw new GoogleOAuthError('token exchange failed');
    }
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) throw new GoogleOAuthError('no access token');

    const infoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) {
      this.logger.warn(`Google userinfo failed: ${infoRes.status}`);
      throw new GoogleOAuthError('userinfo failed');
    }
    const info = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!info.sub || !info.email) throw new GoogleOAuthError('profile missing sub/email');

    return {
      sub: info.sub,
      email: info.email,
      emailVerified: info.email_verified === true,
      name: info.name,
      picture: info.picture,
    };
  }
}

/** 로그인 후 돌아갈 웹 경로. 외부 URL로의 오픈 리다이렉트를 막기 위해 내부 경로만 허용 */
export function sanitizeRedirect(value: unknown, fallback = '/board'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
