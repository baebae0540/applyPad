/**
 * 오래된 둘러보기(데모) 계정 정리.
 *
 * 방문자가 버튼을 누를 때마다 임시 계정이 생기므로 그냥 두면 계속 쌓인다.
 * User를 지우면 지원·면접·메모·태그·refresh 토큰이 전부 onDelete: Cascade로 함께 지워진다.
 *
 * 실행: pnpm --filter @applypad/api build && pnpm --filter @applypad/api demo:cleanup
 * 운영에서는 .github/workflows/cleanup-demo.yml(매일 1회)이 같은 명령을 돌린다.
 * DRY_RUN=1을 주면 지우지 않고 대상 수만 센다.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_EMAIL_PREFIX,
  DEMO_RETENTION_DAYS,
} from '../auth/demo.constants.js';
import { PrismaClient } from '../generated/prisma/client.js';

const DAY_MS = 86_400_000;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL이 필요합니다');

  const days = Number(process.env.DEMO_RETENTION_DAYS ?? DEMO_RETENTION_DAYS);
  const dryRun = process.env.DRY_RUN === '1';
  const before = new Date(Date.now() - days * DAY_MS);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    // startsWith + endsWith로 일반 사용자 이메일이 섞이지 않게 한다
    const where = {
      email: { startsWith: DEMO_EMAIL_PREFIX, endsWith: `@${DEMO_EMAIL_DOMAIN}` },
      createdAt: { lt: before },
    };

    if (dryRun) {
      const count = await prisma.user.count({ where });
      console.log(`[dry-run] ${days}일 지난 데모 계정 ${count}개가 정리 대상입니다`);
      return;
    }

    const { count } = await prisma.user.deleteMany({ where });
    console.log(`${days}일 지난 데모 계정 ${count}개를 정리했습니다 (기준: ${before.toISOString()})`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
