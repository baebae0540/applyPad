# applypad — AI 작업 안내서

이 파일은 이 저장소에서 작업하는 AI 코딩 도구(Claude Code, Copilot 등)와 사람이 **맥락을 이어받기 위한 문서**다.
작업을 시작하기 전에 이 파일 → `docs/PLAN.md` → `README.md` 순서로 읽는다.
작업이 끝나면 아래 **현재 상태**와 **다음 할 일**을 갱신한다.

- 응답과 커밋 메시지, 코드 주석은 **한국어**로 쓴다.
- 개발자는 맥(자택)과 윈도우(회사)를 오간다. 명령어는 OS 차이가 없게 pnpm 스크립트로 제공한다.

## 프로젝트 한 줄 요약

이직 준비 트래커. 지원 현황을 칸반(관심 → 지원 → 서류 통과 → 면접 → 최종 → 합격/불합격)으로 관리하고,
면접 일정·회사 메모·상태 변경 타임라인을 한 곳에 모은다. 이직 포트폴리오로 **설계 → 개발 → 배포 → 운영** 전 과정을 보여주는 것이 목표.

## 스택

| 영역 | 내용 |
| --- | --- |
| Web | Next.js 16 (App Router, `cacheComponents` 켜짐) + React 19 + TypeScript + Tailwind CSS 4 |
| API | NestJS 12 (ESM) + Prisma 7 (`@prisma/adapter-pg`) + class-validator + Swagger |
| DB | PostgreSQL 16 (로컬: `pnpm db:local`, embedded-postgres) |
| 테스트 | vitest (단위 + e2e, e2e는 실제 DB 사용) |
| 모노레포 | pnpm 10 workspace (`apps/api`, `apps/web`) |
| 배포 | 무료 조합: DB **Neon** + API **Render**(Docker) + 웹 **Vercel**, CI/CD는 GitHub Actions → `docs/DEPLOY.md` |

## 로컬 실행 (터미널 3개)

```bash
pnpm db:local      # 1) DB 서버 :5432 (Ctrl+C로 종료, 데이터는 .pgdata/)
pnpm dev:api       # 2) API :4000 (Swagger: http://localhost:3000/api/docs)
pnpm dev:web       # 3) 웹 :3000
```

- 스키마를 바꿨을 때만: `pnpm db:migrate --name <변경내용>`
- 검증: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm --filter @applypad/api test:e2e` (DB 켜져 있어야 함)
- 배포 관련 명령: `pnpm db:deploy`(마이그레이션만 적용), `pnpm demo:cleanup`, `pnpm docker:build:api|web`

## 반드시 지킬 규칙 / 함정

### 공통
- `.env`는 커밋하지 않는다. 새 환경 변수는 `.env.example`과 `apps/api/src/config/env.ts`(검증 클래스)에 함께 추가한다.
- pnpm 10은 설치 스크립트를 기본 차단한다. 설치 스크립트가 필요한 패키지는 `pnpm-workspace.yaml`의 `onlyBuiltDependencies`에 추가한다.

### API (`apps/api`)
- **ESM 프로젝트**: 상대 경로 import에 반드시 `.js` 확장자를 붙인다 (`'./auth.service.js'`).
- 모든 라우트는 전역 prefix **`/api`** 아래에 있다 (`src/setup.ts`). main.ts와 e2e 테스트가 `configureApp()`을 공유한다.
- **인증은 기본 적용**(전역 `JwtAuthGuard`). 로그인 없이 열어야 하는 라우트만 `@Public()`을 붙인다. 현재 사용자는 `@CurrentUser()`.
- **데이터 격리**: 사용자 데이터 조회·수정·삭제는 항상 `where`에 `userId`를 포함한다. 남의 데이터는 403이 아니라 **404**로 응답한다.
- 지원 카드의 **상태 변경은 `PATCH /api/applications/:id/move`로만** 한다 (StatusHistory 기록을 한 곳에 모으기 위해). `PATCH /:id`는 상태를 무시한다.
- Prisma 7: 클라이언트는 `src/generated/prisma`에 생성되고(git 제외, `pnpm install` 시 자동 생성), import는 `'../generated/prisma/client.js'`, enum은 `'../generated/prisma/enums.js'`.
- DB 접속 URL은 `prisma.config.ts`에서 주입한다 (schema.prisma의 datasource에는 url이 없다).
- class-transformer의 `enableImplicitConversion` 때문에 boolean 환경 변수(`'false'`)가 true로 바뀌는 문제가 있었다. boolean은 `@Transform(({ obj, key }) => ...)`로 **원본 값**을 보고 판단한다.
- 테스트: `test/helpers.ts`의 `createTestApp()`, `signup()`을 쓴다. 테스트마다 새 사용자를 만들어 데이터를 격리한다. rate limit은 테스트에서 꺼져 있다.

### Web (`apps/web`)
- **Next.js 16은 학습 데이터와 다를 수 있다.** 코드를 쓰기 전에 `apps/web/AGENTS.md` 안내대로 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.
- `cacheComponents: true` 상태다. 화면은 모두 **클라이언트 컴포넌트에서 API를 호출**하고, 페이지(`page.tsx`)는 metadata와 정적 셸만 담당한다.
- 요청 시점 데이터는 `<Suspense>` 안에서 읽는다: `/applications/[id]`는 `params.then((p) => ...)`을 JSX에 그대로 두고, `useSearchParams`를 쓰는 `/login`·`/signup`도 Suspense로 감싼다. 보호 라우트는 `usePathname` 대신 `<RequireAuth next="/board">`처럼 경로를 직접 넘긴다 (동적 라우트에서 추가 Suspense 없이 쓰기 위해).
- **Activity 함정**: 다른 화면으로 이동해도 컴포넌트가 언마운트되지 않고 상태·DOM이 보존된다(React `<Activity>`).
  - 제출 중 `pending`은 성공해도 `finally`에서 반드시 내린다. (안 내리면 로그아웃 후 돌아온 로그인 폼이 "처리 중…"으로 굳는다 — 실제로 났던 버그)
  - 돌아왔을 때 남으면 안 되는 상태는 **렌더 중 이전 값 비교**로 초기화한다. effect 안의 setState는 `react-hooks/set-state-in-effect` 린트로 막혀 있다.
  - 삭제 후 `queryClient.removeQueries`는 쓰지 않는다. 아직 마운트된 화면이 곧바로 다시 요청해 404가 난다. 목록만 무효화하고 이동한다.
- 서버 데이터는 TanStack Query로 다룬다. 키는 목록 `["applications", { q }]`, 상세 `["application", id]`, 타임라인 `["application", id, "timeline"]`. 무효화는 접두사(`["applications"]`)로 한다.
- 브라우저는 항상 **같은 출처 `/api/*`** 로 호출한다. `next.config.ts`의 rewrites가 API 서버로 프록시한다. rewrites는 **빌드 시점**에 확정되므로 배포 빌드 때 `API_URL`을 넘긴다.
- 디자인 토큰은 `src/app/globals.css`(`--background`, `--surface`, `--accent` 등, 다크 모드 포함). 한글 줄바꿈은 `word-break: keep-all`.
- 상태 색(`src/lib/status.ts`)은 임의의 7색이 아니다. 관심~최종은 **진행 단계**라 파랑 한 색의 순차 램프(라이트는 밝음→어두움, 다크는 그 반대로 직접 고른 값), 합격·불합격은 **결과**라 초록·빨강 상태색. 처음 쓰던 7색 팔레트는 `관심↔지원`이 정상 시야에서도 구분이 어려워서(ΔE 11.8) 바꿨다. 가장 밝은 단계는 표면 대비가 3:1 미만이라 막대·점 옆에 **항상 이름과 숫자를 함께** 표시한다.

### 배포 (Docker / CI / 무료 호스팅) — 자세한 절차는 `docs/DEPLOY.md`
- **운영 구성은 Neon(DB) + Render(API, Docker) + Vercel(웹)이다.** 전부 무료 플랜. Fly.io는 2025년에 무료 티어가 없어져서 기본 경로에서 뺐지만, 유료 전환용으로 `apps/*/fly.toml`과 DEPLOY.md 6장을 남겨뒀다.
- **Render 무료는 15분 유휴 시 멈추고 재기동에 약 1분** 걸린다. `keep-warm.yml`이 한국 09~24시에만 깨운다 (24시간 깨우면 월 750시간 한도에 붙는다).
- **웹은 Vercel이 Next.js를 네이티브로 빌드**하므로 `apps/web/Dockerfile`은 운영에서 쓰이지 않는다. 다만 CI에서 계속 빌드 검증하니 지우지 말 것 (다른 곳으로 옮길 때 그대로 쓴다).
- Render는 포트 10000을 기대한다. `render.yaml`에서 `API_PORT=10000`으로 맞춰뒀다.
- **두 Dockerfile 모두 빌드 컨텍스트가 저장소 루트**다 (`docker build -f apps/api/Dockerfile .`). workspace 파일이 전부 필요하기 때문. `.dockerignore`도 루트에 하나만 있다.
- 웹의 `API_URL`은 **build-arg**다. rewrites가 빌드 시점에 확정되므로 런타임 환경 변수로는 바뀌지 않는다. API 주소가 바뀌면 웹을 다시 빌드해야 한다.
- 웹 이미지는 `output: "standalone"`을 쓴다. pnpm 모노레포라 `outputFileTracingRoot`를 저장소 루트로 올렸고, 그래서 엔트리가 `.next/standalone/apps/web/server.js`다. standalone은 `.next/static`을 복사하지 않으므로 Dockerfile에서 따로 넣는다.
- API 이미지는 `pnpm deploy --prod --legacy --ignore-scripts /out`으로 운영 의존성만 추린다. `--legacy`가 없으면 pnpm 10이 거부하고, `--ignore-scripts`가 없으면 `/out`에 없는 prisma CLI로 postinstall이 돌다가 실패한다.
- Prisma 7 + 드라이버 어댑터는 네이티브 엔진이 없다(전부 WASM). 그래서 slim 이미지에 openssl을 따로 깔지 않아도 되고 `binaryTargets`도 신경 쓸 필요가 없다.
- **마이그레이션은 호스팅이 아니라 `deploy.yml`에서 돌린다.** Render 무료는 셸 접속이 안 되고 운영 트리에 prisma CLI 실행 파일도 없기 때문. 그래서 `render.yaml`은 `autoDeploy: false`이고, CI가 마이그레이션을 끝낸 뒤 **deploy hook**으로 배포를 시작시킨다 (순서가 뒤집히면 새 코드가 옛 스키마를 본다).
- 둘러보기 계정은 매일 `cleanup-demo.yml`이 지운다(7일 기준). 이메일 규칙은 `src/auth/demo.constants.ts` 한 곳에만 둔다.

## 인증 설계 (구현 완료)

- access 토큰: 15분 JWT, 응답 본문으로 전달 → 웹은 **메모리에만** 보관 (localStorage 금지)
- refresh 토큰: 랜덤 문자열, `HttpOnly; SameSite=Lax; Path=/api/auth` 쿠키, DB엔 SHA-256 해시만 저장
- `POST /api/auth/refresh`: refresh 회전. 이미 회전된 토큰이 10초 유예 후 재사용되면 탈취로 보고 해당 사용자 세션 전체 폐기
- 웹은 첫 로딩 때 `POST /api/auth/refresh`로 로그인 상태를 복원한다 (실패하면 비로그인)
- 데모 둘러보기(`POST /api/auth/demo`, `src/auth/demo.service.ts`): 방문자마다 `demo-xxxxxxxx@applypad.demo` 계정을 새로 만들고 샘플 데이터(지원 8건 + 타임라인·면접·메모·태그)를 넣는다. 공용 계정 하나를 쓰면 서로 카드를 옮겨 금방 망가지기 때문. 비밀번호가 없어서(`passwordHash` null) 이메일 로그인으로는 다시 못 들어오는 일회용 계정이다
- Google: `GET /api/auth/google?redirect=/board` → Google → `/api/auth/google/callback` → refresh 쿠키 설정 후 `WEB_ORIGIN + redirect`로 302. 실패 시 `/login?error=google`, 미설정 시 `/login?error=google_disabled`

## API 목록 (구현 완료)

| 메서드 | 경로 | 비고 |
| --- | --- | --- |
| POST | `/api/auth/signup` `{email, password(8+), name?}` | 201, `{accessToken, user}` + 쿠키, 중복 409 |
| POST | `/api/auth/login` `{email, password}` | 200, 실패 401 |
| POST | `/api/auth/demo` | 둘러보기: 샘플 데이터가 담긴 임시 계정 생성 + 바로 로그인 (10분에 5회 제한) |
| POST | `/api/auth/refresh` | 쿠키 필요, `{accessToken, user}` |
| POST | `/api/auth/logout` | 204 |
| GET | `/api/auth/me` 🔒 | `UserDto {id, email, name, avatarUrl, hasPassword, providers}` |
| GET | `/api/auth/google`, `/api/auth/google/callback` | 302 리다이렉트 |
| GET | `/api/applications?status=&q=&tagId=` 🔒 | 상태(enum 순) → sortOrder 순, `tags`, `_count{interviews,notes}` 포함 |
| POST | `/api/applications` 🔒 | `{companyName, position, status?, jobUrl?, appliedAt?, salaryNote?}` 컬럼 맨 아래 추가 |
| GET | `/api/applications/:id` 🔒 | `interviews`, `notes`, `tags` 포함 |
| PATCH | `/api/applications/:id` 🔒 | 상태 제외 필드 수정 |
| PATCH | `/api/applications/:id/move` 🔒 | `{status, index}` 칸반 이동, 상태 변경 시 이력 + 지원일 자동 |
| DELETE | `/api/applications/:id` 🔒 | 204 |
| GET | `/api/applications/:id/timeline` 🔒 | `[{fromStatus, toStatus, changedAt}]` |
| GET / POST | `/api/applications/:applicationId/interviews` 🔒 | 일정순, `{scheduledAt, type?, location?, result?, memo?}` |
| PATCH / DELETE | `/api/applications/:applicationId/interviews/:id` 🔒 | 수정 / 204 |
| GET / POST | `/api/applications/:applicationId/notes` 🔒 | 최신순, `{content}` |
| PATCH / DELETE | `/api/applications/:applicationId/notes/:id` 🔒 | 수정 / 204 |
| GET / POST | `/api/tags` 🔒 | 이름순 + `_count.applications`, 같은 이름 409 |
| PATCH / DELETE | `/api/tags/:id` 🔒 | 수정 / 204 |
| PUT | `/api/applications/:applicationId/tags` 🔒 | `{tagIds}` 통째로 교체 (붙이기·떼기) |
| GET | `/api/dashboard` 🔒 | `{total, statusCounts, upcomingInterviews}` |
| GET | `/api/health` | `{status, db}` |

상태 enum: `INTERESTED`(관심) `APPLIED`(지원) `DOCUMENT_PASSED`(서류 통과) `INTERVIEW`(면접) `FINAL`(최종) `OFFER`(합격) `REJECTED`(불합격)
면접 enum: type `PHONE` `VIDEO` `ONSITE` `CODING_TEST` `OTHER` / result `PENDING` `PASSED` `FAILED`

목록(`GET /api/applications`)의 카드에는 `nextInterview`(결과 미정 + 앞으로 남은 면접 중 가장 가까운 1건)가 함께 온다. 상세는 `interviews`·`notes` 전체를 준다.

## 화면 구성 (구현 완료)

| 경로 | 파일 | 내용 |
| --- | --- | --- |
| `/` | `app/page.tsx`, `components/landing-cta.tsx` | 랜딩. 로그인 상태면 "보드로 이동", 아니면 데모 둘러보기/가입/로그인 |
| `/login`, `/signup` | `app/login/page.tsx`, `app/signup/page.tsx`, `components/auth-form.tsx` | 데모 둘러보기 + 이메일 폼 + Google 버튼, `?next=`·`?error=` 처리 |
| `/board` | `app/board/page.tsx`, `components/board/*` | 7컬럼 칸반, 드래그 이동(낙관적 업데이트), 검색, 태그 필터, 카드에 다가오는 면접 배지 |
| `/applications/[id]` | `app/applications/[id]/page.tsx`, `components/application-detail.tsx`, `components/application/*` | 정보 수정, 상태 변경, 타임라인, 삭제 + 태그·면접·메모 CRUD |
| `/dashboard` | `app/dashboard/page.tsx`, `components/dashboard/dashboard-view.tsx` | 요약 타일, 상태별 지원 막대, 다가오는 면접 |

공용 모듈(`src/lib/`): `types.ts`(API 타입) · `token-store.ts`(access 토큰 메모리 보관) · `api.ts`(`apiFetch` + 401 재시도, single-flight refresh) · `auth-context.tsx`(`useAuth`: `status`/`user`/`login`/`signup`/`logout`) · `status.ts`(상태 라벨·색) · `format.ts`(날짜) · `form.ts` · `use-debounced-value.ts`

## 현재 상태

- [x] 1단계: 모노레포 구조, Prisma 스키마, 로컬 DB
- [x] 2단계: NestJS / Next.js 초기화, Prisma 연결, 헬스체크
- [x] 3단계: 인증(이메일 + Google) + 지원 CRUD API, e2e 27개 / 단위 17개 통과
- [x] 4단계: Next.js 화면 (로그인/가입, 칸반 보드, 상세) — 브라우저로 가입 → 생성 → 드래그 → 새로고침 유지 → 수정 → 삭제 → 로그아웃 흐름 확인
- [x] 5단계: 면접·메모·태그 API/화면 + 대시보드 — e2e 47개 / 단위 17개 통과, 브라우저로 면접 등록 → 보드 배지 → 대시보드 반영 확인
- [x] 6단계(설정): Docker 이미지 2개, GitHub Actions 4종, Render/Vercel/Neon 설정, 데모 계정 정리 — `docs/DEPLOY.md`
- [x] GitHub 저장소: https://github.com/baebae0540/applyPad (main, CI 통과 확인)
- [ ] **실제 배포 실행** ← 다음 (아래 참고)

## 다음 할 일: 실제 배포

코드와 설정은 다 들어갔다. 남은 건 **계정 가입이 필요한 작업**이라 개발자가 직접 해야 한다.
이 머신에는 Docker도 설치되어 있지 않아서 이미지를 실제로 빌드해 본 적은 없다
(대신 이미지에 들어갈 산출물 — `pnpm deploy --prod` 트리와 `.next/standalone` — 을 로컬에서 직접 띄워 검증했고,
CI의 `docker` 잡이 푸시마다 두 이미지를 빌드한다).

1. Neon 가입 → 프로젝트 생성 → `DATABASE_URL` 확보 (DEPLOY.md 2.1)
2. Render 가입 → New → Blueprint로 `render.yaml` 읽히기 → 환경 변수 입력 → Deploy Hook URL 복사 (2.2)
3. Vercel 가입 → Root Directory `apps/web`, 환경 변수 `API_URL` (2.3)
4. GitHub `production` 환경에 secrets(`DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`) + variables(`API_BASE_URL`, `WEB_BASE_URL`) 등록 (2.4)
5. Vercel 주소가 정해지면 Render의 `WEB_ORIGIN`·`GOOGLE_CALLBACK_URL`을 채우고 재배포
6. Google 콘솔에 운영 콜백 URL 추가, 도메인 연결(선택)

### 남은 기능 메모 (v2 이후)
- 태그 색 고르기 UI (API는 `color`를 이미 받는다), 메모 마크다운, 면접 캘린더 뷰
- 기획서 범위 밖: 메일/캘린더 연동, 알림, 팀 공유, 통계 차트
