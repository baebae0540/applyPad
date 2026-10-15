# applypad

이직 준비 트래커. 지원 현황(칸반), 면접 일정, 회사별 메모를 한 곳에서 관리합니다.

| 영역 | 스택 |
| --- | --- |
| Web | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 |
| API | NestJS 12 + Prisma 7 (`@prisma/adapter-pg`) + class-validator + Swagger |
| DB | PostgreSQL 16 |
| 모노레포 | pnpm workspace |

자세한 기획은 [docs/PLAN.md](docs/PLAN.md), 배포 절차는 [docs/DEPLOY.md](docs/DEPLOY.md), 현재 진행 상황과 다음 할 일은 [AGENTS.md](AGENTS.md)를 참고하세요.

## 요구 사항

- Node.js 20 이상 (22 권장)
- pnpm 10 (`corepack enable`로 활성화하면 `packageManager` 버전이 자동 사용됨)
- 로컬 PostgreSQL: Docker 없이 `pnpm db:local`로 실행 (npm 패키지 `embedded-postgres`). Docker가 있으면 `pnpm db:up`도 가능

## 처음 실행

```bash
corepack enable
cp .env.example .env                      # API, DB 설정
cp apps/web/.env.example apps/web/.env.local
pnpm install                              # postinstall에서 prisma generate 실행
```

터미널 1 — DB 실행 (켜둔 채로 둔다, 종료는 Ctrl+C):

```bash
pnpm db:local                             # PostgreSQL 16, 데이터는 .pgdata/에 유지
```

터미널 2 — 첫 마이그레이션:

```bash
pnpm db:migrate --name init               # 첫 마이그레이션 생성 + 적용 (최초 1회)
```

## 개발 서버

DB(`pnpm db:local`)가 켜져 있는 상태에서:

```bash
pnpm dev:api   # http://localhost:4000  (Swagger: /api/docs, 헬스체크: /api/health)
pnpm dev:web   # http://localhost:3000  (/api/* 는 API로 프록시)
```

웹 첫 화면 오른쪽 위 배지가 **API · DB 연결됨**이면 web → api → db 연결이 정상입니다.
API 문서(Swagger)는 http://localhost:3000/api/docs 에서 직접 호출해 볼 수 있습니다.

## 화면

| 경로 | 설명 |
| --- | --- |
| `/` | 랜딩. 로그인 상태면 "보드로 이동" 버튼 |
| `/login`, `/signup` | "데모 계정으로 둘러보기" + 이메일 로그인/가입 + "Google로 계속하기". 로그인 후 `?next=` 경로로 이동 |
| `/board` | 칸반 보드. 7개 컬럼, 카드 드래그로 상태·순서 변경, 검색, 태그 필터, 다가오는 면접 배지 |
| `/applications/[id]` | 지원 상세. 정보 수정, 상태 변경, 타임라인, 태그·면접 일정·메모 관리, 삭제 |
| `/dashboard` | 전체·진행 중·합격·다가오는 면접 요약, 상태별 지원 건수, 다가오는 면접 목록 |

로그인이 필요한 화면(`/board`, `/applications/[id]`, `/dashboard`)에 비로그인으로 들어가면 `/login?next=...`로 보냈다가, 로그인 후 원래 화면으로 돌아옵니다.
**데모 둘러보기**는 방문자마다 샘플 데이터가 담긴 임시 계정을 새로 만들어 주기 때문에, 카드를 마음대로 옮기고 지워도 다른 사람 화면에 영향이 없습니다.
access 토큰은 메모리에만 두기 때문에 새로고침하면 `POST /api/auth/refresh`로 세션을 복원합니다.

## API 요약

모든 경로는 `/api` 아래에 있고, `🔒`는 `Authorization: Bearer <accessToken>`이 필요합니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/auth/signup`, `/api/auth/login` | 이메일 가입/로그인 → access 토큰 + refresh 쿠키 |
| POST | `/api/auth/demo` | 둘러보기용 임시 계정 생성 + 로그인 (샘플 데이터 포함) |
| POST | `/api/auth/refresh` | refresh 쿠키로 access 토큰 재발급 (refresh 토큰 회전) |
| POST | `/api/auth/logout` | refresh 토큰 폐기 |
| GET | `/api/auth/me` 🔒 | 내 정보 |
| GET | `/api/auth/google` → `/api/auth/google/callback` | Google 로그인 (state + PKCE) |
| GET / POST | `/api/applications` 🔒 | 목록(`status`, `q`, `tagId` 필터) / 생성 |
| GET / PATCH / DELETE | `/api/applications/:id` 🔒 | 상세 / 수정 / 삭제 |
| PATCH | `/api/applications/:id/move` 🔒 | 칸반 이동 `{ status, index }` (상태 변경 시 이력 자동 기록) |
| GET | `/api/applications/:id/timeline` 🔒 | 상태 변경 이력 |
| CRUD | `/api/applications/:id/interviews` 🔒 | 면접 일정 (일시·유형·장소·결과·메모) |
| CRUD | `/api/applications/:id/notes` 🔒 | 회사별 메모 |
| CRUD | `/api/tags` 🔒 | 태그 (같은 이름은 409) |
| PUT | `/api/applications/:id/tags` 🔒 | 지원에 붙은 태그 통째로 교체 |
| GET | `/api/dashboard` 🔒 | 상태별 지원 수, 다가오는 면접 |

### 인증 설계

- **access 토큰**: 15분 JWT. 응답 본문으로 받아 메모리에만 보관
- **refresh 토큰**: 랜덤 문자열을 `HttpOnly; SameSite=Lax; Path=/api/auth` 쿠키로 전달, DB에는 SHA-256 해시만 저장
- **회전**: refresh할 때마다 새 토큰 발급. 이미 회전된 토큰이 다시 쓰이면 탈취로 보고 해당 사용자의 모든 세션 폐기 (동시 요청을 위한 10초 유예)
- **같은 출처**: 웹이 `/api/*`를 API로 프록시해서 쿠키가 웹 도메인의 1st-party 쿠키로 동작 (CORS·서드파티 쿠키 문제 없음)
- **비밀번호**: Node 내장 scrypt, 로그인 실패 메시지와 응답 시간을 통일해 계정 존재 여부 노출 방지
- **Google**: Authorization Code + state(CSRF) + PKCE, 같은 이메일 계정이 있으면 연결 (Google 이메일 인증된 경우만)

### Google 로그인 설정 (선택)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → 사용자 인증 정보 → **OAuth 클라이언트 ID** (웹 애플리케이션)
2. 승인된 리디렉션 URI: `http://localhost:3000/api/auth/google/callback`
3. 발급된 값을 `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣고 API 재시작

비워두면 Google 로그인만 비활성화되고 나머지는 그대로 동작합니다.

## 자주 쓰는 명령

| 명령 | 설명 |
| --- | --- |
| `pnpm build` | api, web 전체 빌드 |
| `pnpm test` | 단위 테스트 (vitest) |
| `pnpm --filter @applypad/api test:e2e` | API e2e 테스트 (`pnpm db:local` 실행 + 마이그레이션 적용 필요) |
| `pnpm db:studio` | Prisma Studio로 데이터 확인 |
| `pnpm db:local` | Docker 없이 로컬 PostgreSQL 실행 (Ctrl+C로 종료) |
| `pnpm db:up` / `pnpm db:down` | Docker로 PostgreSQL 실행 / 중지 (Docker 설치 시) |
| `pnpm db:deploy` | 마이그레이션 적용만 (운영·CI용, 새 마이그레이션을 만들지 않음) |
| `pnpm demo:cleanup` | 7일 지난 둘러보기 계정 정리 (`DRY_RUN=1`로 확인만) |
| `pnpm docker:build:api` / `pnpm docker:build:web` | 배포용 이미지 빌드 (컨텍스트는 저장소 루트) |

## 폴더 구조

```
applypad/
├─ apps/
│  ├─ api/                    # NestJS
│  │  ├─ prisma/schema.prisma
│  │  ├─ prisma.config.ts     # Prisma 7 설정 (DATABASE_URL 주입)
│  │  └─ src/
│  │     ├─ config/           # 환경 변수 검증
│  │     ├─ common/           # 입력 정리, 소유권 확인 헬퍼
│  │     ├─ prisma/           # PrismaService (전역 모듈)
│  │     ├─ auth/             # 가입/로그인, JWT, refresh 회전, Google OAuth
│  │     ├─ applications/     # 지원 CRUD, 칸반 이동, 타임라인
│  │     ├─ interviews/       # 면접 일정 CRUD
│  │     ├─ notes/            # 메모 CRUD
│  │     ├─ tags/             # 태그 CRUD, 지원에 붙이기
│  │     ├─ dashboard/        # GET /api/dashboard
│  │     ├─ health/           # GET /api/health
│  │     └─ setup.ts          # 전역 설정 (main.ts와 e2e 테스트 공유)
│  │     └─ (generated/prisma) # prisma generate 결과 (git 제외)
│  └─ web/                    # Next.js
│     └─ src/
│        ├─ app/              # /, /login, /signup, /board, /applications/[id], /dashboard
│        ├─ components/       # auth-form, board/*, application/*, dashboard/*, ui/*
│        └─ lib/              # api(apiFetch·refresh), auth-context, types, status, format
│     └─ Dockerfile          # (api·web 각각) 배포 이미지, 빌드 컨텍스트는 저장소 루트
│     └─ fly.toml            # (api·web 각각) Fly.io 앱 설정
├─ .github/workflows/        # ci.yml, deploy.yml, cleanup-demo.yml
├─ docs/PLAN.md, docs/DEPLOY.md
├─ scripts/db-local.mjs      # Docker 없는 로컬 PostgreSQL
├─ docker-compose.yml
└─ pnpm-workspace.yaml
```

## 배포

무료 플랜만으로 운영합니다 — **DB는 Neon, API는 Render(Docker), 웹은 Vercel**.
main에 푸시하면 CI 통과 후 마이그레이션 → API 배포 → 헬스체크까지 자동으로 돌아갑니다.
계정 설정, 환경 변수, 무료 플랜의 제약(Render 콜드스타트 등), Fly.io 유료 전환 방법은
[docs/DEPLOY.md](docs/DEPLOY.md)에 정리했습니다.

## 진행 상황

- [x] 레포 구조, Docker Compose, Prisma 스키마
- [x] NestJS / Next.js 초기화, Prisma 연결, 헬스체크
- [x] NestJS 인증(이메일 + Google) + 지원 CRUD
- [x] Next.js 화면 (로그인/가입, 칸반, 상세)
- [x] 면접 일정, 메모, 태그, 대시보드
- [x] Docker 이미지, GitHub Actions CI/CD, Fly.io 배포 설정 ([docs/DEPLOY.md](docs/DEPLOY.md))
