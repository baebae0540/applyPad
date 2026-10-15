import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, signup } from './helpers.js';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('Interviews (e2e)', () => {
  let app: NestExpressApplication<App>;
  let token: string;
  let applicationId: string;
  const http = () => request(app.getHttpServer());
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  const addInterview = async (body: Record<string, unknown>, expected = 201) =>
    (await http().post(`/api/applications/${applicationId}/interviews`).set(auth()).send(body).expect(expected)).body;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    token = (await signup(app)).accessToken;
    applicationId = (
      await http().post('/api/applications').set(auth()).send({ companyName: '토스', position: '백엔드' }).expect(201)
    ).body.id;
  });

  it('등록: 기본 유형은 기타, 기본 결과는 예정', async () => {
    const interview = await addInterview({ scheduledAt: inDays(3) });
    expect(interview).toMatchObject({ applicationId, type: 'OTHER', result: 'PENDING', location: null, memo: null });
  });

  it('목록은 일정이 빠른 순', async () => {
    await addInterview({ scheduledAt: inDays(5), type: 'ONSITE' });
    await addInterview({ scheduledAt: inDays(2), type: 'PHONE' });

    const list = (await http().get(`/api/applications/${applicationId}/interviews`).set(auth()).expect(200)).body;
    expect(list.map((i: { type: string }) => i.type)).toEqual(['PHONE', 'ONSITE']);
  });

  it('검증: 잘못된 일시·유형·결과는 400', async () => {
    await addInterview({ scheduledAt: 'tomorrow' }, 400);
    await addInterview({ scheduledAt: inDays(1), type: 'LUNCH' }, 400);
    await addInterview({ scheduledAt: inDays(1), result: 'MAYBE' }, 400);
  });

  it('수정·삭제', async () => {
    const created = await addInterview({ scheduledAt: inDays(1), location: '  강남  ' });
    expect(created.location).toBe('강남');

    const updated = (
      await http()
        .patch(`/api/applications/${applicationId}/interviews/${created.id}`)
        .set(auth())
        .send({ result: 'PASSED', memo: '1차 통과' })
        .expect(200)
    ).body;
    expect(updated).toMatchObject({ result: 'PASSED', memo: '1차 통과' });

    await http().delete(`/api/applications/${applicationId}/interviews/${created.id}`).set(auth()).expect(204);
    expect((await http().get(`/api/applications/${applicationId}/interviews`).set(auth())).body).toEqual([]);
  });

  it('카드 목록에는 다가오는 면접 1건만 nextInterview로 담긴다', async () => {
    const card = async () => (await http().get('/api/applications').set(auth()).expect(200)).body[0];
    expect((await card()).nextInterview).toBeNull();

    await addInterview({ scheduledAt: inDays(-2) }); // 지난 면접
    expect((await card()).nextInterview).toBeNull();

    await addInterview({ scheduledAt: inDays(7) });
    const soon = await addInterview({ scheduledAt: inDays(1) });
    const next = (await card()).nextInterview;
    expect(next).toMatchObject({ id: soon.id });

    // 결과가 정해진 면접은 '다가오는' 목록에서 빠진다
    await http()
      .patch(`/api/applications/${applicationId}/interviews/${soon.id}`)
      .set(auth())
      .send({ result: 'PASSED' })
      .expect(200);
    expect((await card()).nextInterview.id).not.toBe(soon.id);
    expect((await card())._count.interviews).toBe(3);
  });

  it('다른 사용자의 면접은 보이지도, 바꿀 수도 없다 (404)', async () => {
    const mine = await addInterview({ scheduledAt: inDays(1) });
    const other = (await signup(app)).accessToken;

    await http().get(`/api/applications/${applicationId}/interviews`).set(auth(other)).expect(404);
    await http().post(`/api/applications/${applicationId}/interviews`).set(auth(other)).send({ scheduledAt: inDays(1) }).expect(404);
    await http()
      .patch(`/api/applications/${applicationId}/interviews/${mine.id}`)
      .set(auth(other))
      .send({ memo: 'hack' })
      .expect(404);
    await http().delete(`/api/applications/${applicationId}/interviews/${mine.id}`).set(auth(other)).expect(404);
  });

  it('지원 내역을 지우면 면접도 함께 사라진다', async () => {
    await addInterview({ scheduledAt: inDays(1) });
    await http().delete(`/api/applications/${applicationId}`).set(auth()).expect(204);
    await http().get(`/api/applications/${applicationId}/interviews`).set(auth()).expect(404);
  });
});
