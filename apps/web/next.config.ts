import path from "node:path";
import type { NextConfig } from "next";

// 브라우저는 항상 같은 출처의 /api/* 로 요청하고, Next가 API 서버로 프록시한다.
// → CORS가 필요 없고 refresh 쿠키가 웹 도메인의 1st-party 쿠키가 된다.
// 주의: rewrites는 빌드 시점에 확정되므로 배포 빌드 때 API_URL을 넘겨야 한다.
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Docker 배포용 최소 번들(.next/standalone). node_modules 없이 server.js만으로 뜬다.
  output: "standalone",
  // pnpm 모노레포에서는 심볼릭 링크된 실제 패키지가 저장소 루트에 있으므로 추적 기준을 루트로 올린다
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
