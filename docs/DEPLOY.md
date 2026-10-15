# 배포 안내 (6단계)

로컬에서만 돌던 applypad를 실제 URL로 열리게 하고, main에 푸시하면 자동으로 반영되게 하는 절차다.

**무료로 운영할 수 있는 조합을 기본으로 한다.** (Fly.io는 2025년에 무료 티어가 사라져서 기본 경로에서 뺐다.
유료로 옮기고 싶을 때를 위해 `apps/*/fly.toml`과 아래 "Fly.io로 옮기기"를 남겨둔다.)

| 역할 | 서비스 | 요금 | 주소 |
| --- | --- | --- | --- |
| DB | Neon Free | 영구 무료, 카드 불필요 (1GB) | — |
| API | Render Free (Docker) | 무료, 카드 불필요 (월 750시간) | `https://applypad-api.onrender.com` |
| 웹 | Vercel Hobby | 무료 (비상업적 개인 프로젝트) | `https://<프로젝트>.vercel.app` |

브라우저는 **웹 도메인 하나만** 쓴다. `/api/*`는 Next의 rewrites가 Render로 프록시하므로 CORS가 없고
refresh 쿠키가 웹 도메인의 1st-party 쿠키로 남는다. 이 구조 덕분에 웹과 API를 서로 다른 회사에 올려도 그대로 동작한다.

## 무료 플랜의 제약 (미리 알고 있을 것)

- **Render 무료 인스턴스는 15분 동안 요청이 없으면 멈춘다.** 다시 깨어나는 데 약 1분이 걸린다.
  → `.github/workflows/keep-warm.yml`이 한국 09~24시에 10분마다 깨워서 이 시간대에는 콜드스타트가 없다.
    (하루 15시간 × 31일 ≒ 465시간으로 월 750시간 한도 안에 들어온다. 24시간 깨우면 744시간이라 한도에 붙는다.)
- **Render 무료는 셸 접속이 안 된다.** 그래서 마이그레이션과 데모 정리는 GitHub Actions에서 돌린다.
- **Neon 무료는 프로젝트당 1GB, 월 100 CU-시간.** 이 서비스 규모에는 넉넉하다.
- **Vercel Hobby는 비상업적 개인 사용만 허용**된다. 이직 포트폴리오는 여기에 해당한다.

---

## 1. 이미지 구조

API는 Docker로 올라가고, 웹은 Vercel이 Next.js를 네이티브로 빌드한다.
`apps/web/Dockerfile`은 운영에서 쓰이지 않지만 CI에서 계속 빌드 검증하므로, 나중에 어디로든 옮길 수 있다.

두 Dockerfile 모두 **빌드 컨텍스트가 저장소 루트**다 (pnpm workspace 파일이 전부 필요하다).

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
- Render는 포트 10000을 기대하므로 `API_PORT=10000`을 넣어준다 (`render.yaml`).

### 웹 (`apps/web/Dockerfile`, 현재는 CI 검증용)

- `output: "standalone"` 결과물만 옮긴다. `outputFileTracingRoot`를 저장소 루트로 올려서 pnpm 심볼릭 링크가 끊기지 않게 했고,
  그래서 엔트리 경로가 `apps/web/server.js`다.
- standalone은 정적 파일을 복사하지 않으므로 `.next/static`을 따로 넣는다.
- **`API_URL`은 build-arg다.** rewrites는 빌드 시점에 확정되므로 API 주소가 바뀌면 다시 빌드해야 한다.
  (Vercel에서도 마찬가지로 **빌드 환경 변수**다. 바꾸면 재배포해야 반영된다.)

---

## 2. 처음 한 번만 하는 준비

### 2.1 DB — Neon

1. https://neon.com 가입 (GitHub 계정으로 가능, 카드 불필요)
2. 프로젝트 생성 → PostgreSQL 16, 리전은 `Asia Pacific (Singapore)` 권장
3. 연결 문자열 복사 (`postgresql://...?sslmode=require`) — 이걸 **DATABASE_URL**이라고 부른다

### 2.2 API — Render

1. https://render.com 가입 (GitHub 연동)
2. **New → Blueprint** → 이 저장소 선택 → 루트의 `render.yaml`을 자동으로 읽는다
3. `sync: false`로 표시된 값들을 입력한다:

| 변수 | 값 |
| --- | --- |
| `DATABASE_URL` | 2.1에서 받은 Neon 연결 문자열 |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` 결과 |
| `WEB_ORIGIN` | 2.3에서 정해지는 Vercel 주소 (먼저 비워두고 나중에 채워도 된다) |
| `GOOGLE_CALLBACK_URL` | `<Vercel 주소>/api/auth/google/callback` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google 로그인을 쓸 때만 |

4. 배포되면 주소를 확인한다 (`https://applypad-api.onrender.com`)
5. **Settings → Deploy Hook** URL을 복사해 둔다 (2.4에서 쓴다)

> `render.yaml`에 `autoDeploy: false`로 둔 이유: 푸시와 동시에 배포가 시작되면 마이그레이션보다 새 코드가 먼저 뜰 수 있다.
> GitHub Actions가 마이그레이션을 끝낸 뒤 deploy hook으로 배포를 시작시킨다.

### 2.3 웹 — Vercel

1. https://vercel.com 가입 (GitHub 연동) → **Add New → Project** → 이 저장소 선택
2. 설정:

| 항목 | 값 |
| --- | --- |
| Framework Preset | Next.js (자동 감지) |
| Root Directory | **`apps/web`** |
| Include source files outside of the Root Directory | **켜기** (pnpm workspace라 루트의 lockfile이 필요하다) |

3. Environment Variables에 추가 (Production):

| 변수 | 값 |
| --- | --- |
| `API_URL` | `https://applypad-api.onrender.com` |

4. 배포 후 주소를 확인하고, **2.2의 `WEB_ORIGIN`·`GOOGLE_CALLBACK_URL`을 그 주소로 채운 뒤 Render를 재배포**한다.

### 2.4 GitHub 설정

저장소 Settings → Environments → **`production`** 생성 후:

**Secrets**

| 이름 | 값 |
| --- | --- |
| `DATABASE_URL` | Neon 연결 문자열 |
| `RENDER_DEPLOY_HOOK_URL` | 2.2에서 복사한 Deploy Hook URL |

**Variables** (비밀이 아니므로 variables로 둔다)

| 이름 | 값 |
| --- | --- |
| `API_BASE_URL` | `https://applypad-api.onrender.com` |
| `WEB_BASE_URL` | `https://<프로젝트>.vercel.app` |

> `keep-warm.yml`은 `production` 환경을 쓰지 않으므로, `API_BASE_URL`은 **저장소 수준 Variables에도** 같은 값으로 넣어둔다.

### 2.5 Google 로그인 (선택)

Google Cloud Console → 사용자 인증 정보 → 승인된 리디렉션 URI에 `<Vercel 주소>/api/auth/google/callback`을 추가한다.
비워두면 Google 로그인만 비활성화되고 나머지는 그대로 동작한다.

---

## 3. 자동화 (GitHub Actions)

| 워크플로 | 시점 | 하는 일 |
| --- | --- | --- |
| `ci.yml` | PR, main 푸시 | 린트 → 빌드 → 단위 테스트 → (Postgres 16 서비스 컨테이너로) 마이그레이션 + e2e. 별도 잡에서 두 도커 이미지 빌드 |
| `deploy.yml` | CI 성공 후 main, 수동 | 운영 DB 마이그레이션 → Render 배포 시작 → API·웹 헬스체크 |
| `cleanup-demo.yml` | 매일 03:00 KST, 수동 | 7일 지난 둘러보기 계정 삭제 |
| `keep-warm.yml` | 09~24시 10분마다 | Render 인스턴스를 깨워 콜드스타트 방지 |

웹(Vercel)은 Git 연동으로 푸시 즉시 알아서 배포된다. `deploy.yml`은 떴는지만 확인한다.

### 마이그레이션을 왜 호스팅이 아니라 CI에서 돌리나

Render 무료 인스턴스는 셸 접속이 안 되고, 운영 이미지에는 `node_modules/.bin/prisma`도 없다
(prisma CLI가 devDependency라 `--prod` 트리에서 빠진다). CI에서 돌리면 **새 코드가 뜨기 전에** 스키마가 맞춰지고,
실패하면 배포 자체가 시작되지 않는다.

---

## 4. 데모 계정 정리

둘러보기 버튼은 누를 때마다 `demo-xxxxxxxx@applypad.demo` 계정을 새로 만든다. 그대로 두면 Neon 1GB를 갉아먹는다.

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
curl https://applypad-api.onrender.com/api/health   # {"status":"ok","db":"up"}
```

- Render 대시보드에서 로그와 인스턴스 시간 사용량(월 750시간)을 확인한다.
- Neon 대시보드에서 저장 공간과 CU-시간을 확인한다.
- 첫 요청이 느리면 인스턴스가 자고 있던 것이다 (밤 시간대). `keep-warm.yml`을 수동 실행하면 바로 깨울 수 있다.

---

## 6. Fly.io로 옮기기 (유료, 월 $4~8)

무료 플랜의 콜드스타트가 거슬리거나 트래픽이 늘면 Fly로 옮긴다. 설정 파일(`apps/api/fly.toml`, `apps/web/fly.toml`)은 그대로 남겨뒀다.

- 무료 티어는 없다. 체험은 **머신 가동 2시간 또는 7일** 중 먼저 끝나는 쪽까지고, 이후 카드 등록이 필요하다.
- `shared-cpu-1x` 512MB 상시 가동 기준 월 $3.69, 앱이 둘이라 $8 안팎. 단 두 fly.toml 모두
  `auto_stop_machines = "suspend"` + `min_machines_running = 0`이라 트래픽이 없으면 멈춰서 실제 청구는 훨씬 적다.
- 절차: `fly apps create applypad-api applypad-web` → `fly secrets set ...` →
  `fly deploy . --config apps/api/fly.toml` (저장소 루트에서, dockerfile 경로는 fly.toml 기준)
- `deploy.yml`의 Render 단계를 `superfly/flyctl-actions/setup-flyctl` + `flyctl deploy`로 바꾸고
  `FLY_API_TOKEN` 시크릿을 추가한다.
- 이미지 안에서 마이그레이션을 돌리고 싶다면: `prisma`·`dotenv`를 `dependencies`로 옮기고,
  Dockerfile 실행 단계에 `prisma/`와 `prisma.config.ts`를 복사한 뒤
  `[deploy] release_command = "node_modules/.bin/prisma migrate deploy"`를 추가한다.
  `prisma` 패키지는 `@prisma/client`의 peer로 이미 운영 트리에 들어 있고 스키마 엔진도 WASM이라 용량은 거의 늘지 않는다.

## 7. 도메인 연결 (선택)

Vercel 프로젝트 Settings → Domains에서 추가하고 DNS 레코드를 넣는다. 그 뒤:

1. Render의 `WEB_ORIGIN`·`GOOGLE_CALLBACK_URL`을 새 도메인으로 바꾸고
2. Google 콘솔에 새 콜백 URL을 추가한 뒤
3. GitHub Variables의 `WEB_BASE_URL`도 바꾼다

API 주소는 그대로여도 된다 (브라우저가 직접 부르지 않는다).
