// Docker 없이 로컬 PostgreSQL을 띄운다 (npm 패키지 embedded-postgres 사용).
// 사용법: pnpm db:local   (Ctrl+C로 종료, 데이터는 .pgdata/에 유지)
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.pgdata');

const user = process.env.POSTGRES_USER ?? 'applypad';
const password = process.env.POSTGRES_PASSWORD ?? 'applypad';
const database = process.env.POSTGRES_DB ?? 'applypad';
const port = Number(process.env.POSTGRES_PORT ?? 5432);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: true,
  onLog: () => {},
});

const firstRun = !existsSync(path.join(dataDir, 'PG_VERSION'));
if (firstRun) {
  console.log('처음 실행: 데이터 폴더를 초기화합니다 (.pgdata/)');
  await pg.initialise();
}

try {
  await pg.start();
} catch (err) {
  const detail = err instanceof Error ? `: ${err.message}` : '';
  console.error(`PostgreSQL을 시작하지 못했습니다${detail}`);
  console.error(
    `- 이미 다른 터미널에서 db:local이 실행 중이거나, ${port} 포트를 다른 프로그램이 쓰고 있을 수 있습니다.\n` +
      `  확인: lsof -i :${port}`,
  );
  process.exit(1);
}

if (firstRun) {
  await pg.createDatabase(database);
}

console.log(`PostgreSQL 실행 중 → postgresql://${user}:****@localhost:${port}/${database}`);
console.log('종료하려면 Ctrl+C');

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('\nPostgreSQL 종료 중...');
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
