import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, signup } from './helpers.js';

describe('Applications (e2e)', () => {
  let app: NestExpressApplication<App>;
  let token: string;
  const http = () => request(app.getHttpServer());
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  const create = async (body: Record<string, unknown>) =>
    (await http().post('/api/applications').set(auth()).send(body).expect(201)).body;
  const columnIds = async (status: string) =>
    (await http().get(`/api/applications?status=${status}`).set(auth()).expect(200)).body.map(
      (a: { id: string }) => a.id,
    );

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    token = (await signup(app)).accessToken; // 테스트마다 새 사용자 → 데이터 격리
  });

  it('생성: 기본 상태는 관심, 컬럼 맨 아래에 추가, 첫 이력 기록', async () => {
    const a = await create({ companyName: ' 토스 ', position: '백엔드' });
    const b = await create({ companyName: '당근', position: '웹' });
    expect(a).toMatchObject({ companyName: '토스', status: 'INTERESTED', sortOrder: 0, appliedAt: null });
    expect(b.sortOrder).toBe(1);

    const timeline = (await http().get(`/api/applications/${a.id}/timeline`).set(auth()).expect(200)).body;
    expect(timeline).toEqual([expect.objectContaining({ fromStatus: null, toStatus: 'INTERESTED' })]);
  });

  it('지원 상태로 만들면 지원일이 자동으로 채워진다', async () => {
    const a = await create({ companyName: 'A', position: 'P', status: 'APPLIED' });
    expect(a.appliedAt).not.toBeNull();
  });

  it('검증: 빈 회사명, 잘못된 URL, 잘못된 상태는 400', async () => {
    await http().post('/api/applications').set(auth()).send({ companyName: '  ', position: 'P' }).expect(400);
    await http()
      .post('/api/applications')
      .set(auth())
      .send({ companyName: 'A', position: 'P', jobUrl: 'javascript:alert(1)' })
      .expect(400);
    await http().post('/api/applications').set(auth()).send({ companyName: 'A', position: 'P', status: 'NOPE' }).expect(400);
  });

  it('목록: 상태 필터, 회사명·직무 검색(대소문자 무시)', async () => {
    await create({ companyName: 'Kakao', position: 'Backend' });
    await create({ companyName: '네이버', position: 'Frontend', status: 'APPLIED' });

    const all = (await http().get('/api/applications').set(auth()).expect(200)).body;
    expect(all).toHaveLength(2);
    expect(all[0]).toHaveProperty('_count');

    expect((await http().get('/api/applications?status=APPLIED').set(auth())).body).toHaveLength(1);
    expect((await http().get('/api/applications?q=kakao').set(auth())).body[0].companyName).toBe('Kakao');
    expect((await http().get('/api/applications?q=front').set(auth())).body[0].companyName).toBe('네이버');
  });

  it('상세·수정: 수정 API로는 상태를 바꿀 수 없다', async () => {
    const a = await create({ companyName: 'A', position: 'P' });
    const updated = (
      await http()
        .patch(`/api/applications/${a.id}`)
        .set(auth())
        .send({ salaryNote: '희망 6천', jobUrl: 'https://example.com/job', status: 'OFFER' })
        .expect(200)
    ).body;
    expect(updated).toMatchObject({ salaryNote: '희망 6천', jobUrl: 'https://example.com/job', status: 'INTERESTED' });

    const detail = (await http().get(`/api/applications/${a.id}`).set(auth()).expect(200)).body;
    expect(detail).toMatchObject({ interviews: [], notes: [], tags: [] });
  });

  it('칸반 이동: 다른 컬럼의 원하는 위치로 옮기고 이력을 남긴다', async () => {
    const x = await create({ companyName: 'X', position: 'P', status: 'APPLIED' });
    const y = await create({ companyName: 'Y', position: 'P', status: 'APPLIED' });
    const a = await create({ companyName: 'A', position: 'P' });

    const moved = (
      await http().patch(`/api/applications/${a.id}/move`).set(auth()).send({ status: 'APPLIED', index: 1 }).expect(200)
    ).body;
    expect(moved.status).toBe('APPLIED');
    expect(moved.appliedAt).not.toBeNull();
    expect(await columnIds('APPLIED')).toEqual([x.id, a.id, y.id]);
    expect(await columnIds('INTERESTED')).toEqual([]);

    const timeline = (await http().get(`/api/applications/${a.id}/timeline`).set(auth())).body;
    expect(timeline.map((t: { toStatus: string }) => t.toStatus)).toEqual(['INTERESTED', 'APPLIED']);
  });

  it('칸반 이동: 같은 컬럼 안 순서 변경은 이력을 남기지 않는다, 범위 밖 index는 맨 끝', async () => {
    const a = await create({ companyName: 'A', position: 'P' });
    const b = await create({ companyName: 'B', position: 'P' });
    const c = await create({ companyName: 'C', position: 'P' });

    await http().patch(`/api/applications/${c.id}/move`).set(auth()).send({ status: 'INTERESTED', index: 0 }).expect(200);
    expect(await columnIds('INTERESTED')).toEqual([c.id, a.id, b.id]);

    await http().patch(`/api/applications/${c.id}/move`).set(auth()).send({ status: 'INTERESTED', index: 99 }).expect(200);
    expect(await columnIds('INTERESTED')).toEqual([a.id, b.id, c.id]);

    const timeline = (await http().get(`/api/applications/${c.id}/timeline`).set(auth())).body;
    expect(timeline).toHaveLength(1);
  });

  it('삭제하면 이후 조회는 404', async () => {
    const a = await create({ companyName: 'A', position: 'P' });
    await http().delete(`/api/applications/${a.id}`).set(auth()).expect(204);
    await http().get(`/api/applications/${a.id}`).set(auth()).expect(404);
  });

  it('다른 사용자의 지원 내역은 보이지도, 바꿀 수도 없다 (404)', async () => {
    const mine = await create({ companyName: '내 회사', position: 'P' });
    const other = (await signup(app)).accessToken;

    expect((await http().get('/api/applications').set(auth(other)).expect(200)).body).toEqual([]);
    await http().get(`/api/applications/${mine.id}`).set(auth(other)).expect(404);
    await http().patch(`/api/applications/${mine.id}`).set(auth(other)).send({ position: 'hack' }).expect(404);
    await http()
      .patch(`/api/applications/${mine.id}/move`)
      .set(auth(other))
      .send({ status: 'OFFER', index: 0 })
      .expect(404);
    await http().get(`/api/applications/${mine.id}/timeline`).set(auth(other)).expect(404);
    await http().delete(`/api/applications/${mine.id}`).set(auth(other)).expect(404);

    // 원래 주인의 데이터는 그대로
    const still = (await http().get(`/api/applications/${mine.id}`).set(auth()).expect(200)).body;
    expect(still).toMatchObject({ position: 'P', status: 'INTERESTED' });
  });
});
