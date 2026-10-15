import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// apps/api/.env → 모노레포 루트 .env 순서로 읽는다 (먼저 읽은 값이 우선)
config({ path: path.resolve(import.meta.dirname, '.env'), quiet: true });
config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate`(postinstall, Docker 빌드)는 DB 접속이 필요 없으므로
    // URL이 없어도 실패하지 않게 둔다. migrate 계열 명령은 실제 URL이 필요하다.
    url: process.env.DATABASE_URL ?? '',
  },
});
