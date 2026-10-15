import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, refreshCookieFrom } from './helpers.js';

describe('Demo 둘러보기 (e2e)', () => {
  let app: NestExpressApplication<App>;
  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const startDemo = async () => {
    const res = await http().post('/api/auth/demo').expect(201);
    return { token: res.body.accessToken as string, user: res.body.user, cookie: refreshCookieFrom(res) };
  };

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('바로 로그인된 상태가 되고, 비밀번호 없는 일회용 계정이다', async () => {
    const { token, user, cookie } = await startDemo();

    expect(token).toEqual(expect.any(String));
    expect(cookie).toBeDefined();
    expect(user).toMatchObject({ name: '데모 사용자', hasPassword: false, providers: [] });
    expect(user.email).toMatch(/^demo-[0-9a-f]{8}@applypad\.demo$/);

    const me = (await http().get('/api/auth/me').set(auth(token)).expect(200)).body;
    expect(me.id).toBe(user.id);
  });

  it('샘플 데이터(칸반·타임라인·면접·메모·태그)가 채워져 있다', async () => {
    const { token } = await startDemo();

    const applications = (await http().get('/api/applications').set(auth(token)).expect(200)).body;
    expect(applications.length).toBeGreaterThanOrEqual(6);

    // 모든 컬럼이 비어 있지 않게: 관심~불합격까지 두루 쓰였는지
    const statuses = new Set(applications.map((a: { status: string }) => a.status));
    expect(statuses).toContain('INTERESTED');
    expect(statuses).toContain('INTERVIEW');
    expect(statuses).toContain('OFFER');
    expect(statuses).toContain('REJECTED');

    const toss = applications.find((a: { companyName: string }) => a.companyName === '토스');
    expect(toss.nextInterview).not.toBeNull();
    expect(toss.tags.length).toBeGreaterThan(0);
    expect(toss._count).toMatchObject({ interviews: 2, notes: 2 });

    const timeline = (await http().get(`/api/applications/${toss.id}/timeline`).set(auth(token)).expect(200)).body;
    expect(timeline.length).toBeGreaterThanOrEqual(4);
    expect(timeline[0].fromStatus).toBeNull();
    expect(timeline.at(-1).toStatus).toBe('INTERVIEW');
    // 이력은 과거부터 쌓여 있어야 한다
    expect(new Date(timeline[0].changedAt).getTime()).toBeLessThan(Date.now());

    const tags = (await http().get('/api/tags').set(auth(token)).expect(200)).body;
    expect(tags.length).toBe(3);

    const dashboard = (await http().get('/api/dashboard').set(auth(token)).expect(200)).body;
    expect(dashboard.total).toBe(applications.length);
    expect(dashboard.upcomingInterviews.length).toBeGreaterThan(0);
    // 다가오는 면접은 모두 미래 + 결과 미정
    for (const interview of dashboard.upcomingInterviews) {
      expect(new Date(interview.scheduledAt).getTime()).toBeGreaterThan(Date.now());
      expect(interview.result).toBe('PENDING');
    }
  });

  it('방문자마다 별도 계정이라 서로의 데이터가 보이지 않는다', async () => {
    const first = await startDemo();
    const second = await startDemo();
    expect(first.user.id).not.toBe(second.user.id);

    const mine = (await http().get('/api/applications').set(auth(first.token)).expect(200)).body;
    await http().delete(`/api/applications/${mine[0].id}`).set(auth(first.token)).expect(204);

    // 지운 건 내 보드에서만 빠진다
    const theirs = (await http().get('/api/applications').set(auth(second.token)).expect(200)).body;
    expect(theirs.length).toBe(mine.length);
    await http().get(`/api/applications/${mine[0].id}`).set(auth(second.token)).expect(404);
  });
});
