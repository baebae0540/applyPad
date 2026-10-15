import path from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApplicationsModule } from './applications/applications.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { InterviewsModule } from './interviews/interviews.module.js';
import { NotesModule } from './notes/notes.module.js';
import { TagsModule } from './tags/tags.module.js';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // apps/api/.env → 모노레포 루트 .env 순서로 읽는다
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
      ],
      validate: validateEnv,
    }),
    // 기본 한도. 로그인/가입 등은 컨트롤러에서 @Throttle로 더 좁힌다
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
      errorMessage: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요',
    }),
    PrismaModule,
    AuthModule,
    ApplicationsModule,
    InterviewsModule,
    NotesModule,
    TagsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
