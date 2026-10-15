"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { FullPageSpinner } from "./ui/feedback";

/**
 * 보호 라우트. 비로그인이면 /login?next=... 으로 보낸다.
 * next는 URL 훅(usePathname) 대신 페이지가 직접 넘긴다 (cacheComponents에서 Suspense 없이 쓰기 위해).
 */
export function RequireAuth({ next, children }: { next: string; children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "guest") router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [status, next, router]);

  if (status !== "authed") {
    return <FullPageSpinner label={status === "guest" ? "로그인 화면으로 이동 중" : "불러오는 중"} />;
  }

  return <>{children}</>;
}
