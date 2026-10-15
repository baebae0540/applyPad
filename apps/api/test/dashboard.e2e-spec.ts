import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, signup } from './helpers.js';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('Dashboard (e2e)', () => {
  let app: NestExpressApplication<App>;
  let token: string;
  const http = () => request(app.getHttpServer());
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  const createApplication = async (companyName: string, status?: string) =>
    (await http().post('/api/applications').set(auth()).send({ companyName, position: 'P', status }).expect(201)).body;
  const addInterview = async (applicationId: string, body: Record<string, unknown>) =>
    (await http().post(`/api/applications/${applicationId}/interviews`).set(auth()).send(body).expect(201)).body;
  const dashboard = async (t = token) =>
    (await http().get('/api/dashboard').set(auth(t)).expect(200)).body;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    token = (await signup(app)).accessToken;
  });

  it('비어 있어도 모든 상태가 0으로 채워져 온다', async () => {
    const data = await dashboard();
    expect(data.total).toBe(0);
    expect(data.upcomingInterviews).toEqual([]);
    expect(data.statusCounts).toEqual({
      INTERESTED: 0,
      APPLIED: 0,
      DOCUMENT_PASSED: 0,
      INTERVIEW: 0,
      FINAL: 0,
      OFFER: 0,
      REJECTED: 0,
    });
  });

  it('상태별 지원 수를 센다', async () => {
    await createApplication('A');
    await createApplication('B');
    await createApplication('C', 'APPLIED');
    await createApplication('D', 'OFFER');

    const data = await dashboard();
    expect(data.total).toBe(4);
    expect(data.statusCounts).toMatchObject({ INTERESTED: 2, APPLIED: 1, OFFER: 1, REJECTED: 0 });
  });

  it('다가오는 면접만 가까운 순으로, 회사 정보와 함께 준다', async () => {
    const toss = await createApplication('토스', 'INTERVIEW');
    const kakao = await createApplication('카카오', 'INTERVIEW');

    await addInterview(toss.id, { scheduledAt: inDays(-1) }); // 지난 일정
    await addInterview(toss.id, { scheduledAt: inDays(5), type: 'ONSITE' });
    await addInterview(kakao.id, { scheduledAt: inDays(2), type: 'VIDEO' });
    const done = await addInterview(kakao.id, { scheduledAt: inDays(3) });
    await http()
      .patch(`/api/applications/${kakao.id}/interviews/${done.id}`)
      .set(auth())
      .send({ result: 'FAILED' })
      .expect(200); // 결과가 나온 일정은 제외

    const { upcomingInterviews } = await dashboard();
    expect(upcomingInterviews).toHaveLength(2);
    expect(upcomingInterviews[0]).toMatchObject({
      type: 'VIDEO',
      application: { id: kakao.id, companyName: '카카오', status: 'INTERVIEW' },
    });
    expect(upcomingInterviews[1]).toMatchObject({ type: 'ONSITE', application: { companyName: '토스' } });
  });

  it('다른 사용자의 데이터는 섞이지 않는다', async () => {
    const mine = await createApplication('내회사', 'INTERVIEW');
    await addInterview(mine.id, { scheduledAt: inDays(1) });

    const other = (await signup(app)).accessToken;
    const theirs = await dashboard(other);
    expect(theirs.total).toBe(0);
    expect(theirs.upcomingInterviews).toEqual([]);
  });
});
