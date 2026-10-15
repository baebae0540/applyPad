import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, signup } from './helpers.js';

describe('Notes (e2e)', () => {
  let app: NestExpressApplication<App>;
  let token: string;
  let applicationId: string;
  const http = () => request(app.getHttpServer());
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  const addNote = async (content: string, expected = 201) =>
    (await http().post(`/api/applications/${applicationId}/notes`).set(auth()).send({ content }).expect(expected)).body;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    token = (await signup(app)).accessToken;
    applicationId = (
      await http().post('/api/applications').set(auth()).send({ companyName: '카카오', position: '플랫폼' }).expect(201)
    ).body.id;
  });

  it('작성·목록(최신순)·수정·삭제', async () => {
    await addNote('  첫 번째 메모  ');
    const second = await addNote('두 번째 메모');

    const list = (await http().get(`/api/applications/${applicationId}/notes`).set(auth()).expect(200)).body;
    expect(list.map((n: { content: string }) => n.content)).toEqual(['두 번째 메모', '첫 번째 메모']);

    const updated = (
      await http()
        .patch(`/api/applications/${applicationId}/notes/${second.id}`)
        .set(auth())
        .send({ content: '고친 메모' })
        .expect(200)
    ).body;
    expect(updated.content).toBe('고친 메모');

    await http().delete(`/api/applications/${applicationId}/notes/${second.id}`).set(auth()).expect(204);
    expect((await http().get(`/api/applications/${applicationId}/notes`).set(auth())).body).toHaveLength(1);
  });

  it('메모 수는 카드 목록의 _count에 반영된다', async () => {
    await addNote('메모');
    const card = (await http().get('/api/applications').set(auth()).expect(200)).body[0];
    expect(card._count.notes).toBe(1);
  });

  it('빈 내용은 400', async () => {
    await addNote('   ', 400);
    await http().post(`/api/applications/${applicationId}/notes`).set(auth()).send({}).expect(400);
  });

  it('다른 사용자의 메모는 보이지도, 바꿀 수도 없다 (404)', async () => {
    const mine = await addNote('내 메모');
    const other = (await signup(app)).accessToken;

    await http().get(`/api/applications/${applicationId}/notes`).set(auth(other)).expect(404);
    await http().post(`/api/applications/${applicationId}/notes`).set(auth(other)).send({ content: 'hack' }).expect(404);
    await http()
      .patch(`/api/applications/${applicationId}/notes/${mine.id}`)
      .set(auth(other))
      .send({ content: 'hack' })
      .expect(404);
    await http().delete(`/api/applications/${applicationId}/notes/${mine.id}`).set(auth(other)).expect(404);
  });
});
