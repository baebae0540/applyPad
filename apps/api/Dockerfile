# syntax=docker/dockerfile:1
#
# API(NestJS + Prisma) 이미지. 빌드 컨텍스트는 **저장소 루트**다.
#   docker build -f apps/api/Dockerfile -t applypad-api .
#
# Prisma 7은 드라이버 어댑터(@prisma/adapter-pg) + WASM 쿼리 컴파일러를 쓰므로
# 네이티브 엔진 바이너리나 openssl이 필요 없다. slim 이미지로 충분하다.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# ---------- 빌드 ----------
FROM base AS build

# 매니페스트를 먼저 복사해 소스가 바뀌어도 설치 레이어 캐시가 살아남게 한다
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# postinstall의 `prisma generate`가 스키마와 설정 파일을 읽는다
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @applypad/api...

COPY apps/api apps/api
RUN pnpm --filter @applypad/api build

# 운영 의존성만 추린 트리를 /out에 만든다 (devDependencies 제외).
# --legacy: pnpm 10은 injected workspace가 아니면 새 deploy를 막는다.
# --ignore-scripts: /out에는 prisma CLI가 없어 postinstall(generate)이 돌면 안 된다.
#                   생성된 클라이언트는 이미 dist/generated/prisma로 컴파일되어 있다.
RUN pnpm --filter @applypad/api --prod --legacy --ignore-scripts deploy /out

# ---------- 실행 ----------
FROM base AS runner
ENV NODE_ENV=production \
    API_PORT=4000

COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/package.json ./package.json

USER node
EXPOSE 4000
# 마이그레이션은 이미지가 아니라 배포 워크플로에서 돌린다 (docs/DEPLOY.md 참고)
CMD ["node", "dist/main.js"]
