import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { configureApp } from './setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app); // 전역 prefix(/api), 쿠키, CORS, 검증 파이프 (e2e 테스트와 공유)
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('applypad API')
    .setDescription('이직 준비 트래커 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, swagger));

  const port = app.get(ConfigService<Env, true>).get('API_PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`applypad API listening on http://localhost:${port} (docs: /api/docs)`);
}
await bootstrap();
