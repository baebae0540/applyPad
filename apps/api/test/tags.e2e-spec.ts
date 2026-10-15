import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, signup } from './helpers.js';

describe('Tags (e2e)', () => {
  let app: NestExpressApplication<App>;
  let token: string;
  const http = () => request(app.getHttpServer());
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  const createTag = async (body: Record<string, unknown>, expected = 201) =>
    (await http().post('/api/tags').set(auth()).send(body).expect(expected)).body;
  const createApplication = async (companyName: string) =>
    (await http().post('/api/applications').set(auth()).send({ companyName, position: 'P' }).expect(201)).body;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    token = (await signup(app)).accessToken;
  });

  it('생성·목록(이름순)·수정·삭제', async () => {
    await createTag({ name: '원격근무', color: '#2f5d50' });
    await createTag({ name: '  네카라  ' });

    const list = (await http().get('/api/tags').set(auth()).expect(200)).body;
    expect(list.map((t: { name: string }) => t.name)).toEqual(['네카라', '원격근무']);
    expect(list[0]._count.applications).toBe(0);

    const updated = (
      await http().patch(`/api/tags/${list[0].id}`).set(auth()).send({ color: '#ff0000' }).expect(200)
    ).body;
    expect(updated.color).toBe('#ff0000');

    await http().delete(`/api/tags/${list[0].id}`).set(auth()).expect(204);
    expect((await http().get('/api/tags').set(auth())).body).toHaveLength(1);
  });

  it('검증: 빈 이름 400, 잘못된 색 400, 같은 이름 409', async () => {
    await createTag({ name: '  ' }, 400);
    await createTag({ name: '색', color: 'red' }, 400);
    await createTag({ name: '중복' });
    await createTag({ name: '중복' }, 409);
  });

  it('지원에 태그를 붙이고 떼고, 태그로 거를 수 있다', async () => {
    const remote = await createTag({ name: '원격' });
    const startup = await createTag({ name: '스타트업' });
    const a = await createApplication('A사');
    await createApplication('B사');

    const tagged = (
      await http()
        .put(`/api/applications/${a.id}/tags`)
        .set(auth())
        .send({ tagIds: [remote.id, startup.id] })
        .expect(200)
    ).body;
    expect(tagged.tags.map((t: { tag: { name: string } }) => t.tag.name).sort()).toEqual(['스타트업', '원격']);

    const filtered = (await http().get(`/api/applications?tagId=${remote.id}`).set(auth()).expect(200)).body;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].companyName).toBe('A사');
    expect((await http().get('/api/tags').set(auth())).body.find((t: { id: string }) => t.id === remote.id)._count.applications).toBe(1);

    // 통째로 교체: 하나만 남긴다
    const replaced = (
      await http().put(`/api/applications/${a.id}/tags`).set(auth()).send({ tagIds: [startup.id] }).expect(200)
    ).body;
    expect(replaced.tags).toHaveLength(1);

    // 빈 배열이면 모두 뗀다
    const cleared = (
      await http().put(`/api/applications/${a.id}/tags`).set(auth()).send({ tagIds: [] }).expect(200)
    ).body;
    expect(cleared.tags).toEqual([]);
  });

  it('태그를 지우면 지원에서도 떨어진다', async () => {
    const tag = await createTag({ name: '삭제될태그' });
    const a = await createApplication('A사');
    await http().put(`/api/applications/${a.id}/tags`).set(auth()).send({ tagIds: [tag.id] }).expect(200);

    await http().delete(`/api/tags/${tag.id}`).set(auth()).expect(204);
    const detail = (await http().get(`/api/applications/${a.id}`).set(auth()).expect(200)).body;
    expect(detail.tags).toEqual([]);
  });

  it('다른 사용자의 태그는 쓸 수도, 바꿀 수도 없다 (404)', async () => {
    const mine = await createTag({ name: '내태그' });
    const myApplication = await createApplication('내회사');
    const other = (await signup(app)).accessToken;

    expect((await http().get('/api/tags').set(auth(other)).expect(200)).body).toEqual([]);
    await http().patch(`/api/tags/${mine.id}`).set(auth(other)).send({ name: 'hack' }).expect(404);
    await http().delete(`/api/tags/${mine.id}`).set(auth(other)).expect(404);
    await http().put(`/api/applications/${myApplication.id}/tags`).set(auth(other)).send({ tagIds: [mine.id] }).expect(404);

    // 남의 태그를 내 지원에 붙이려 해도 404
    const otherApplication = (
      await http().post('/api/applications').set(auth(other)).send({ companyName: '남의회사', position: 'P' }).expect(201)
    ).body;
    await http()
      .put(`/api/applications/${otherApplication.id}/tags`)
      .set(auth(other))
      .send({ tagIds: [mine.id] })
      .expect(404);
  });
});
