import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Env } from './config/env.js';

/** main.ts와 e2e 테스트가 같은 설정으로 앱을 띄우도록 공통화 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<Env, true>);

  // 모든 API는 /api 아래에 둔다. 웹(Next.js)이 /api/* 를 그대로 프록시하므로
  // 브라우저 입장에서는 같은 출처가 되어 refresh 쿠키가 1st-party 쿠키로 동작한다.
  app.setGlobalPrefix('api');
  // Next 프록시·Fly.io 뒤에서 실제 클라이언트 IP를 쓰기 위해 (rate limit 기준)
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
