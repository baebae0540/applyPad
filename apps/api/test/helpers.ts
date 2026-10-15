import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/setup.js';

// 로컬 DB(pnpm db:local + pnpm db:migrate)가 떠 있어야 한다.
export async function createTestApp(
  override?: (b: ReturnType<typeof Test.createTestingModule>) => void,
): Promise<NestExpressApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    // 테스트는 짧은 시간에 요청이 몰리므로 rate limit을 끈다 (rate limit 자체는 별도 테스트)
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true });
  override?.(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

export const uniqueEmail = () => `test-${randomUUID()}@applypad.test`;

/** Set-Cookie 헤더에서 refresh 쿠키 값을 꺼낸다 */
export function refreshCookieFrom(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('applypad_rt='))?.split(';')[0];
}

export async function signup(app: NestExpressApplication<App>, email = uniqueEmail(), password = 'password-1234') {
  const res = await request(app.getHttpServer())
    .post('/api/auth/signup')
    .send({ email, password, name: '테스터' })
    .expect(201);
  return {
    email,
    password,
    accessToken: res.body.accessToken as string,
    cookie: refreshCookieFrom(res)!,
    userId: res.body.user.id as string,
  };
}
