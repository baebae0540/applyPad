"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { googleLoginUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/button";
import { ErrorText } from "./ui/feedback";
import { TextField } from "./ui/text-field";

type Mode = "login" | "signup";

const COPY = {
  login: {
    title: "로그인",
    description: "데모로 먼저 둘러보거나, 이메일·Google 계정으로 들어갈 수 있어요.",
    submit: "로그인",
    switchText: "아직 계정이 없으세요?",
    switchLabel: "가입하기",
    switchHref: "/signup",
  },
  signup: {
    title: "가입하기",
    description: "이메일만 있으면 바로 시작할 수 있어요. 먼저 데모로 둘러봐도 좋아요.",
    submit: "가입하고 시작하기",
    switchText: "이미 계정이 있으세요?",
    switchLabel: "로그인",
    switchHref: "/login",
  },
} as const satisfies Record<Mode, unknown>;

/** Google 콜백이 실패하면 /login?error=... 로 돌아온다 */
const OAUTH_ERROR: Record<string, string> = {
  google: "Google 로그인에 실패했습니다. 다시 시도해 주세요.",
  google_disabled: "Google 로그인이 아직 설정되지 않았습니다. 이메일로 로그인해 주세요.",
};

/** 열린 리다이렉트 방지: 같은 사이트의 내부 경로만 허용한다 */
function sanitizeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/board";
  return value;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const { status, login, signup, startDemo } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const oauthError = OAUTH_ERROR[searchParams.get("error") ?? ""];

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // 이미 로그인된 상태로 들어오면 원래 가려던 화면으로 보낸다
  useEffect(() => {
    if (status === "authed") router.replace(next);
  }, [status, next, router]);

  // cacheComponents(Activity)는 다른 화면으로 이동해도 이 컴포넌트를 언마운트하지 않는다.
  // 로그아웃해서 이 화면으로 돌아왔을 때(authed → guest) 지난 제출의 흔적을 지운다.
  const [lastStatus, setLastStatus] = useState(status);
  if (lastStatus !== status) {
    setLastStatus(status);
    if (status === "guest") {
      setError(null);
      setPending(false);
    }
  }

  async function onDemo() {
    setError(null);
    setPending(true);
    try {
      await startDemo();
      router.replace("/board");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "데모 계정을 만들지 못했습니다");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    setError(null);
    setPending(true);
    try {
      if (mode === "signup") await signup({ email, password, name: name || undefined });
      else await login({ email, password });
      router.replace(next);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "요청을 처리하지 못했습니다");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-1.5">
        <Link href="/" className="text-sm text-muted">
          ← applypad
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
      </div>

      {oauthError ? <ErrorText message={oauthError} /> : null}

      <div className="flex flex-col gap-1.5">
        <Button type="button" onClick={onDemo} disabled={pending} className="py-2.5">
          {pending ? "준비 중…" : "데모 계정으로 둘러보기"}
        </Button>
        <p className="text-center text-xs text-muted">
          가입 없이 샘플 데이터가 채워진 임시 계정으로 바로 들어갑니다.
        </p>
      </div>

      <a
        href={googleLoginUrl(next)}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition hover:bg-accent-soft"
      >
        Google로 계속하기
      </a>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        또는 이메일로
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="이메일"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="me@example.com"
          required
          maxLength={254}
        />
        {mode === "signup" ? (
          <TextField label="이름 (선택)" name="name" autoComplete="name" maxLength={50} />
        ) : null}
        <TextField
          label="비밀번호"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          maxLength={128}
          hint={mode === "signup" ? "8자 이상" : undefined}
        />

        {error ? <ErrorText message={error} /> : null}

        <Button type="submit" variant="secondary" disabled={pending} className="mt-1 py-2.5">
          {pending ? "처리 중…" : copy.submit}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="font-medium text-accent underline">
          {copy.switchLabel}
        </Link>
      </p>
    </main>
  );
}
