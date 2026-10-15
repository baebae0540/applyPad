# syntax=docker/dockerfile:1
#
# 웹(Next.js) 이미지. 빌드 컨텍스트는 **저장소 루트**다.
#   docker build -f apps/web/Dockerfile --build-arg API_URL=https://applypad-api.fly.dev -t applypad-web .
#
# 주의: /api/* 프록시(rewrites)는 빌드 시점에 확정되므로 API_URL을 반드시 build-arg로 넘긴다.
# 런타임에 바꿔도 반영되지 않는다.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# ---------- 빌드 ----------
FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @applypad/web...

COPY apps/web apps/web

ARG API_URL=http://localhost:4000
ENV API_URL=$API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @applypad/web build

# ---------- 실행 ----------
# output: "standalone" 결과물만 옮긴다 (node_modules 설치 불필요).
# outputFileTracingRoot가 저장소 루트라서 엔트리가 apps/web/server.js에 생긴다.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/apps/web/.next/standalone ./
# standalone은 정적 파일을 복사하지 않으므로 직접 옮긴다 (CDN을 쓰지 않는 구성)
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
