import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './helpers.js';

describe('Health (e2e)', () => {
  let app: NestExpressApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('GET /api/health → 로그인 없이 접근 가능, DB up', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
      }));

  it('보호된 라우트는 토큰 없이 401', () =>
    request(app.getHttpServer()).get('/api/applications').expect(401));
});
