# applypad 기획서

이직 준비 트래커. 지원 현황, 면접 일정, 회사별 메모를 한 화면에서 관리한다.
이직 포트폴리오로 **설계 → 개발 → 배포 → 운영**까지 한 사이클을 보여주는 것이 목표.

## 1. 서비스 개요

- 지원 현황을 칸반으로 관리: 관심 → 지원 → 서류 통과 → 면접 → 최종 → 합격 / 불합격
- 회사별 메모, 면접 일정, 상태 변경 타임라인을 한 곳에 정리
- 본인이 실제로 쓰려고 만든 도구 (면접 스토리: "직접 쓰려고 만들었다")

## 2. MVP 기능

| 영역 | 내용 |
| --- | --- |
| 인증 | 이메일 가입/로그인 + Google 소셜 로그인, JWT access + httpOnly 쿠키 refresh(회전) |
| 지원 카드 | CRUD, 드래그로 상태 변경, 칸반 내 순서 유지 |
| 면접 일정 | 일정 등록/수정, 다가오는 일정 대시보드 |
| 메모/태그 | 회사별 메모, 태그, 검색/필터 |
| 타임라인 | 상태 변경 이력 서버에서 자동 기록 |
| 데모 | 데모 계정 + 샘플 데이터 시드 |

범위 밖 (v2 이후): 메일/캘린더 연동, 알림, 팀 공유, 통계 차트.

## 3. 기술 스택

- **Web**: Next.js 16 (App Router) + React 19 + TypeScript, Tailwind, TanStack Query, dnd-kit
- **API**: NestJS 12 + Prisma 7 (pg 드라이버 어댑터) + class-validator, @nestjs/jwt, Google OAuth(직접 구현), @nestjs/throttler, Swagger
- **DB**: PostgreSQL 16 (로컬은 `pnpm db:local`(embedded-postgres) 또는 Docker Compose, 운영은 Neon 등 매니지드)
- **배포**: Docker, GitHub Actions CI/CD, Fly.io
- **모노레포**: pnpm workspace

## 4. 폴더 구조

```
applypad/
├─ apps/
│  ├─ web/            # Next.js
│  └─ api/            # NestJS + Prisma
│     └─ prisma/schema.prisma
├─ docs/
│  └─ PLAN.md
├─ .github/workflows/ # CI/CD
├─ docker-compose.yml # 로컬 PostgreSQL
├─ pnpm-workspace.yaml
└─ package.json
```

## 5. DB 설계

`apps/api/prisma/schema.prisma` 참고.

- `User`: 이메일 가입은 `passwordHash`, 소셜 전용 계정은 null
- `Account`: 소셜 연동 (`provider` + `providerAccountId` 유니크), 한 유저가 여러 provider 연결 가능
- `RefreshToken`: 해시만 저장, 재발급 시 회전, 폐기 시각 기록
- `Application`: 회사/직무/상태/공고 URL/지원일/연봉 메모, 칸반 정렬 순서
- `StatusHistory`: from/to 상태와 변경 시각
- `Interview`: 일시, 유형, 장소, 결과
- `Note`, `Tag`, `ApplicationTag`

## 6. API 개요

모든 경로는 `/api` 접두사를 쓴다 (예: `/api/auth/login`). 최신 목록은 README와 Swagger(`/api/docs`) 참고.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | /auth/signup, /auth/login | 이메일 가입/로그인 |
| GET | /auth/google, /auth/google/callback | Google 로그인 |
| GET | /auth/me | 내 정보 |
| POST | /auth/refresh, /auth/logout | 토큰 재발급/로그아웃 |
| GET/POST | /applications | 목록(필터/검색)/생성 |
| PATCH | /applications/:id | 수정 (상태 제외) |
| PATCH | /applications/:id/move | 칸반 이동: 상태·순서 변경 (이력 자동 기록) |
| DELETE | /applications/:id | 삭제 |
| GET | /applications/:id/timeline | 상태 변경 이력 |
| CRUD | /applications/:id/interviews, /notes | 면접, 메모 |
| GET | /dashboard | 다가오는 일정, 상태별 카운트 |

## 7. 진행 순서

1. 레포 구조, Docker Compose, Prisma 스키마 ✅
2. NestJS / Next.js 초기화, Prisma 연결, 헬스체크 ✅
3. NestJS 인증(이메일 + Google) + 지원 CRUD API ✅
4. Next.js 화면: 로그인, 칸반, 상세 ✅
5. 면접 일정, 메모, 태그, 대시보드 ✅
6. 테스트 몇 개, CI/CD, Fly.io 배포, 도메인 연결

## 8. 결정 사항

- 서비스 이름: **applypad**
- 로그인: 이메일 + Google 소셜 로그인
- 구조: 모노레포
- 백엔드: ASP.NET Core 대신 NestJS (TS 풀스택으로 통일)
- Prisma 7 사용: 생성 클라이언트는 `apps/api/src/generated/prisma`, 접속 URL은 `prisma.config.ts`에서 주입
- API는 전역 prefix `/api`, 웹(Next.js)이 `/api/*`를 rewrites로 프록시 → refresh 쿠키를 1st-party로 운영 (`*.fly.dev`처럼 웹·API 도메인이 달라도 동작)
- refresh 토큰은 JWT가 아닌 불투명 랜덤 값 + DB 해시 저장 (즉시 폐기·회전·재사용 감지가 가능하도록)
- Google 로그인은 Passport 대신 직접 구현 (state + PKCE를 쿠키로 관리, 세션 저장소 불필요). 흐름을 코드로 설명할 수 있게
- 비밀번호 해시는 Node 내장 scrypt (네이티브 모듈 설치 없이 맥/윈도우/리눅스·Docker 동일 동작)
- 로컬 DB는 Docker 대신 `pnpm db:local`(embedded-postgres)도 지원
