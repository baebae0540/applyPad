# 배포 안내 (6단계)

로컬에서만 돌던 applypad를 Docker 이미지로 묶어 Fly.io에 올리고, main에 푸시하면 자동으로 배포되게 하는 절차다.

| 구성 | 값 |
| --- | --- |
| 웹 | Fly 앱 `applypad-web` → https://applypad-web.fly.dev |
| API | Fly 앱 `applypad-api` → https://applypad-api.fly.dev (`/api/docs`에 Swagger) |
| DB | Neon 등 매니지드 PostgreSQL 16 (Fly Postgres를 써도 된다) |
| 리전 | `nrt` (도쿄) |

브라우저는 **웹 도메인 하나만** 쓴다. `/api/*`는 Next의 rewrites가 API 앱으로 프록시하므로 CORS가 없고
refresh 쿠키가 웹 도메인의 1st-party 쿠키로 남는다.

---

## 1. 이미지 구조

두 이미지 모두 **빌드 컨텍스트가 저장소 루트**다 (pnpm workspace 파일이 전부 필요하다).

```bash
pnpm docker:build:api   # docker build -f apps/api/Dockerfile -t applypad-api .
pnpm docker:build:web   # API_URL을 build-arg로 넘긴다
```

### API (`apps/api/Dockerfile`)

- `node:24-slim` + corepack. Prisma 7은 드라이버 어댑터(`@prisma/adapter-pg`) + WASM 쿼리 컴파일러라서
  네이티브 엔진 바이너리도 openssl도 필요 없다.
- 매니페스트 → `prisma/` → 소스 순으로 복사해 설치 레이어 캐시를 살린다 (postinstall의 `prisma generate`가 스키마를 읽는다).
- 운영 트리는 `pnpm deploy --prod --legacy --ignore-scripts /out`으로 추린다.
  - `--legacy`: pnpm 10은 injected workspace가 아니면 새 deploy 구현을 막는다.
  - `--ignore-scripts`: `/out`에는 prisma CLI가 없으므로 postinstall이 돌면 안 된다. 생성된 클라이언트는 이미 `dist/generated/prisma`로 컴파일되어 있다.
- 최종 이미지에는 `node_modules`, `dist`, `package.json`만 들어간다.

### 웹 (`apps/web/Dockerfile`)

- `output: "standalone"` 결과물만 옮긴다. `outputFileTracingRoot`를 저장소 루트로 올려서 pnpm 심볼릭 링크가 끊기지 않게 했고,
  그래서 엔트리 경로가 `apps/web/server.js`다.
- standalone은 정적 파일을 복사하지 않으므로 `.next/static`을 따로 넣는다 (CDN을 쓰지 않는 구성).
- **`API_URL`은 build-arg다.** rewrites는 빌드 시점에 확정되므로 API 주소가 바뀌면 다시 빌드해야 한다.

---

## 2. 처음 한 번만 하는 준비

### 2.1 DB

Neon에서 PostgreSQL 16 프로젝트를 만들고 연결 문자열을 받는다 (`?sslmode=require` 포함).

### 2.2 Fly 앱 만들기

```bash
fly auth login
fly apps create applypad-api
fly apps create applypad-web
```

### 2.3 시크릿 (API 앱)

비밀이 아닌 값(`API_PORT`, `WEB_ORIGIN`, `COOKIE_SECURE`, `GOOGLE_CALLBACK_URL`)은 `apps/api/fly.toml`의 `[env]`에 있다.
나머지는 시크릿으로 넣는다.

```bash
fly secrets set --app applypad-api \
  DATABASE_URL="postgresql://...?sslmode=require" \
  JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..."
```

운영에서 반드시 로컬과 달라야 하는 값:

| 변수 | 운영 값 | 이유 |
| --- | --- | --- |
| `COOKIE_SECURE` | `true` | HTTPS에서만 refresh 쿠키를 보낸다 |
| `JWT_ACCESS_SECRET` | 긴 랜덤 문자열 | `.env.example`의 기본값은 공개되어 있다 |
| `WEB_ORIGIN` | `https://applypad-web.fly.dev` | CORS 허용 + 로그인 후 리다이렉트 대상 |
| `GOOGLE_CALLBACK_URL` | `https://applypad-web.fly.dev/api/auth/google/callback` | Google 콘솔의 "승인된 리디렉션 URI"에 **똑같이** 등록해야 한다 |

### 2.4 GitHub 시크릿

저장소 Settings → Environments → `production`에 등록한다.

| 이름 | 값 |
| --- | --- |
| `FLY_API_TOKEN` | `fly tokens create deploy` 결과 |
| `DATABASE_URL` | 운영 DB 연결 문자열 (마이그레이션·데모 정리에 쓴다) |

### 2.5 첫 배포

```bash
pnpm --filter @applypad/api exec prisma migrate deploy   # DATABASE_URL=운영
fly deploy . --config apps/api/fly.toml
fly deploy . --config apps/web/fly.toml
```

---

## 3. 자동화 (GitHub Actions)

| 워크플로 | 시점 | 하는 일 |
| --- | --- | --- |
| `ci.yml` | PR, main 푸시 | 린트 → 빌드 → 단위 테스트 → (Postgres 16 서비스 컨테이너로) 마이그레이션 + e2e. 별도 잡에서 두 도커 이미지 빌드 |
| `deploy.yml` | CI 성공 후 main, 수동 | 운영 DB 마이그레이션 → API 배포 → 웹 배포 → 헬스체크 |
| `cleanup-demo.yml` | 매일 03:00 KST, 수동 | 7일 지난 둘러보기 계정 삭제 |

### 마이그레이션을 왜 Fly release_command가 아니라 CI에서 돌리나

운영 이미지에는 `node_modules/.bin/prisma`가 없다 (prisma CLI가 devDependency라서 `--prod` 트리에서 빠진다).
CI에서 돌리면 **새 코드가 뜨기 전에** 스키마가 맞춰지고, 실패하면 배포 자체가 중단된다.

이미지 안에서 돌리고 싶다면:

1. `apps/api/package.json`의 `prisma`·`dotenv`를 `dependencies`로 옮기고
2. Dockerfile 실행 단계에 `prisma/`와 `prisma.config.ts`를 복사한 뒤
3. `apps/api/fly.toml`에 `[deploy] release_command = "node_modules/.bin/prisma migrate deploy"`를 추가한다.

`prisma` 패키지는 `@prisma/client`의 peer로 이미 운영 트리에 들어 있어서(스키마 엔진도 WASM이다) 용량은 거의 늘지 않는다.

---

## 4. 데모 계정 정리

둘러보기 버튼은 누를 때마다 `demo-xxxxxxxx@applypad.demo` 계정을 새로 만든다. 그대로 두면 계속 쌓인다.

```bash
pnpm demo:cleanup              # 7일 지난 계정 삭제
DRY_RUN=1 pnpm demo:cleanup    # 대상 수만 확인
DEMO_RETENTION_DAYS=1 pnpm demo:cleanup
```

- 스크립트: `apps/api/src/scripts/cleanup-demo.ts`
- `User`만 지우면 지원·면접·메모·태그·refresh 토큰이 `onDelete: Cascade`로 함께 지워진다.
- 이메일 접두사(`demo-`)와 도메인(`@applypad.demo`)을 **둘 다** 확인해서 일반 사용자가 섞이지 않게 한다.

---

## 5. 운영 점검

```bash
curl https://applypad-api.fly.dev/api/health      # {"status":"ok","db":"up"}
fly logs --app applypad-api
fly status --app applypad-web
```

- 두 앱 모두 `auto_stop_machines = "suspend"` + `min_machines_running = 0`이다. 트래픽이 없으면 멈추고,
  요청이 오면 깨어난다 (포트폴리오 용도라 비용을 0에 가깝게 두기 위함). 첫 요청이 조금 느릴 수 있다.
- 헬스체크 경로는 API `/api/health`, 웹 `/`.

## 6. 도메인 연결 (선택)

```bash
fly certs add applypad.example.com --app applypad-web
```

DNS에 Fly가 알려주는 A/AAAA 레코드를 넣고 인증서가 발급되면,

1. `apps/api/fly.toml`의 `WEB_ORIGIN`·`GOOGLE_CALLBACK_URL`을 새 도메인으로 바꾸고
2. Google 콘솔에 새 콜백 URL을 추가한 뒤
3. 두 앱을 다시 배포한다 (웹은 `API_URL`이 build-arg라 재빌드가 필요하다).
