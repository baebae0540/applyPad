"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const PRIMARY = "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white dark:text-background";
const SECONDARY = "rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-accent-soft";

/** 로그인 상태에 따라 랜딩의 버튼을 바꾼다 (복원 중에는 비로그인 기준으로 보여준다) */
export function LandingCta() {
  const { status, startDemo } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (status === "authed") {
    return (
      <Link href="/board" className={PRIMARY}>
        보드로 이동
      </Link>
    );
  }

  async function onDemo() {
    setPending(true);
    try {
      await startDemo();
      router.replace("/board");
    } catch {
      // 실패하면 로그인 화면에서 다시 시도할 수 있게 보낸다
      router.push("/login");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={onDemo} disabled={pending} className={`${PRIMARY} disabled:opacity-50`}>
        {pending ? "준비 중…" : "데모 둘러보기"}
      </button>
      <Link href="/signup" className={SECONDARY}>
        시작하기
      </Link>
      <Link href="/login" className={SECONDARY}>
        로그인
      </Link>
    </>
  );
}
