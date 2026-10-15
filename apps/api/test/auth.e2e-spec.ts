import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { REFRESH_REUSE_GRACE_MS } from '../src/auth/auth.constants.js';
import { GoogleOAuthService, type GoogleProfile } from '../src/auth/google-oauth.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, refreshCookieFrom, signup, uniqueEmail } from './helpers.js';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  // Google은 외부 호출 대신 고정 프로필을 돌려주는 가짜로 대체
  let googleProfile: GoogleProfile;
  const fakeGoogle = {
    enabled: true,
    createAuthorization: (redirect: string) => ({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?fake=1',
      pending: { state: 'state-123', verifier: 'verifier-123', redirect },
    }),
    fetchProfile: vi.fn(async () => googleProfile),
  };

  beforeAll(async () => {
    app = await createTestApp((b) => b.overrideProvider(GoogleOAuthService).useValue(fakeGoogle));
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  describe('이메일 가입/로그인', () => {
    it('가입하면 access 토큰과 httpOnly refresh 쿠키를 준다', async () => {
      const email = uniqueEmail();
      const res = await http().post('/api/auth/signup').send({ email, password: 'password-1234' }).expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email, hasPassword: true, providers: [] });
      expect(res.body.user.passwordHash).toBeUndefined();

      const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('applypad_rt='))!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/SameSite=Lax/);
    });

    it('이메일은 소문자로 정규화되고 중복 가입은 409', async () => {
      const email = uniqueEmail();
      await http().post('/api/auth/signup').send({ email: email.toUpperCase(), password: 'password-1234' }).expect(201);
      await http().post('/api/auth/signup').send({ email, password: 'password-1234' }).expect(409);
    });

    it('입력값 검증: 짧은 비밀번호, 잘못된 이메일, 알 수 없는 필드는 400', async () => {
      await http().post('/api/auth/signup').send({ email: uniqueEmail(), password: 'short' }).expect(400);
      await http().post('/api/auth/signup').send({ email: 'not-email', password: 'password-1234' }).expect(400);
      await http()
        .post('/api/auth/signup')
        .send({ email: uniqueEmail(), password: 'password-1234', isAdmin: true })
        .expect(400);
    });

    it('로그인 성공 / 틀린 비밀번호와 없는 계정은 같은 401 메시지', async () => {
      const { email, password } = await signup(app);
      await http().post('/api/auth/login').send({ email, password }).expect(200);

      const wrong = await http().post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);
      const missing = await http()
        .post('/api/auth/login')
        .send({ email: uniqueEmail(), password: 'wrong-password' })
        .expect(401);
      expect(wrong.body.message).toBe(missing.body.message);
    });

    it('GET /api/auth/me: 토큰이 있으면 내 정보, 위조 토큰은 401', async () => {
      const { accessToken, email } = await signup(app);
      const me = await http().get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(me.body.email).toBe(email);
      await http().get('/api/auth/me').set('Authorization', `Bearer ${accessToken}x`).expect(401);
    });
  });

  describe('refresh 토큰 회전', () => {
    it('refresh하면 새 access 토큰과 새 쿠키를 받고, 이전 쿠키는 더 이상 못 쓴다', async () => {
      const { cookie } = await signup(app);
      const res = await http().post('/api/auth/refresh').set('Cookie', cookie).expect(200);
      const next = refreshCookieFrom(res)!;
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(next).not.toBe(cookie);

      await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
      await http().post('/api/auth/refresh').set('Cookie', next).expect(200);
    });

    it('회전된 토큰이 유예 시간 뒤에 다시 쓰이면 탈취로 보고 모든 세션을 끊는다', async () => {
      const { cookie, userId } = await signup(app);
      const res = await http().post('/api/auth/refresh').set('Cookie', cookie).expect(200);
      const current = refreshCookieFrom(res)!;

      // 이전 토큰이 유예 시간보다 오래전에 폐기된 것처럼 만든다
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: { not: null } },
        data: { revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1000) },
      });
      await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
      // 정상 사용 중이던 최신 토큰도 함께 폐기됨
      await http().post('/api/auth/refresh').set('Cookie', current).expect(401);
    });

    it('만료된 refresh 토큰은 401', async () => {
      const { cookie, userId } = await signup(app);
      await prisma.refreshToken.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('로그아웃하면 refresh 토큰이 폐기되고 쿠키가 지워진다', async () => {
      const { cookie } = await signup(app);
      const res = await http().post('/api/auth/logout').set('Cookie', cookie).expect(204);
      expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/applypad_rt=;/);
      await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('쿠키 없이 refresh하면 401', () => http().post('/api/auth/refresh').expect(401));
  });

  describe('Google 로그인', () => {
    const pendingCookie = (redirect = '/board') =>
      `applypad_oauth=${encodeURIComponent(JSON.stringify({ state: 'state-123', verifier: 'verifier-123', redirect }))}`;

    it('시작: Google로 리다이렉트하고 state 쿠키를 심는다', async () => {
      const res = await http().get('/api/auth/google?redirect=/board').expect(302);
      expect(res.headers.location).toContain('accounts.google.com');
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(/^applypad_oauth=/);
      expect(cookie).toMatch(/HttpOnly/);
    });

    it('콜백: 새 사용자를 만들고 refresh 쿠키와 함께 웹으로 돌려보낸다', async () => {
      googleProfile = { sub: `g-${Date.now()}`, email: uniqueEmail(), emailVerified: true, name: '구글 유저' };
      const res = await http()
        .get('/api/auth/google/callback?code=abc&state=state-123')
        .set('Cookie', pendingCookie('/board'))
        .expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/board');
      const cookie = refreshCookieFrom(res)!;

      const refreshed = await http().post('/api/auth/refresh').set('Cookie', cookie).expect(200);
      expect(refreshed.body.user).toMatchObject({
        email: googleProfile.email,
        name: '구글 유저',
        hasPassword: false,
        providers: ['google'],
      });
    });

    it('같은 이메일로 가입한 계정이 있으면 Google 계정을 연결한다 (중복 사용자 생성 안 함)', async () => {
      const { email, userId } = await signup(app);
      googleProfile = { sub: `g-${Date.now()}`, email, emailVerified: true };
      await http().get('/api/auth/google/callback?code=abc&state=state-123').set('Cookie', pendingCookie()).expect(302);

      const accounts = await prisma.account.findMany({ where: { userId } });
      expect(accounts).toHaveLength(1);
      expect(await prisma.user.count({ where: { email } })).toBe(1);
    });

    it('state가 다르면 로그인하지 않고 에러로 돌려보낸다 (CSRF 방지)', async () => {
      fakeGoogle.fetchProfile.mockClear();
      const res = await http()
        .get('/api/auth/google/callback?code=abc&state=attacker')
        .set('Cookie', pendingCookie())
        .expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/login?error=google');
      expect(fakeGoogle.fetchProfile).not.toHaveBeenCalled();
      expect(refreshCookieFrom(res)).toBeUndefined();
    });

    it('이메일 미인증 Google 계정은 거부', async () => {
      googleProfile = { sub: `g-${Date.now()}`, email: uniqueEmail(), emailVerified: false };
      const res = await http()
        .get('/api/auth/google/callback?code=abc&state=state-123')
        .set('Cookie', pendingCookie())
        .expect(302);
      expect(res.headers.location).toContain('/login?error=google');
    });

    it('외부 URL로의 리다이렉트 시도는 기본 경로로 바뀐다', async () => {
      googleProfile = { sub: `g-${Date.now()}`, email: uniqueEmail(), emailVerified: true };
      const res = await http()
        .get('/api/auth/google/callback?code=abc&state=state-123')
        .set('Cookie', pendingCookie('//evil.example.com'))
        .expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/board');
    });
  });
});
