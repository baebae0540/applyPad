"use client";

/**
 * 로그인 상태를 앱 전체에 공유한다.
 * access 토큰은 메모리에만 있으므로, 새로고침하면 첫 마운트 때 refresh 쿠키로 세션을 복원한다.
 */
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  signup as signupRequest,
  startDemo as startDemoRequest,
} from "./api";
import { getAccessToken, subscribeAccessToken } from "./token-store";
import type { LoginInput, SignupInput, User } from "./types";

export type AuthStatus = "loading" | "authed" | "guest";

type Session = { status: AuthStatus; user: User | null };

type AuthValue = Session & {
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  /** 가입 없이 샘플 데이터가 담긴 임시 계정으로 들어간다 */
  startDemo: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading", user: null });
  const queryClient = useQueryClient();

  // 첫 로딩: refresh 쿠키로 로그인 상태 복원 (쿠키가 없거나 만료면 비로그인)
  useEffect(() => {
    let alive = true;
    refreshSession()
      .then((res) => {
        if (alive) setSession({ status: "authed", user: res.user });
      })
      .catch(() => {
        if (alive) setSession({ status: "guest", user: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  // 토큰이 비면(refresh 실패 등) 어디서 일어났든 비로그인으로 내린다
  useEffect(
    () =>
      subscribeAccessToken(() => {
        if (getAccessToken() !== null) return;
        setSession((prev) => {
          if (prev.status !== "authed") return prev;
          queryClient.clear();
          return { status: "guest", user: null };
        });
      }),
    [queryClient],
  );

  const value = useMemo<AuthValue>(
    () => ({
      ...session,
      login: async (input) => {
        const res = await loginRequest(input);
        queryClient.clear();
        setSession({ status: "authed", user: res.user });
      },
      signup: async (input) => {
        const res = await signupRequest(input);
        queryClient.clear();
        setSession({ status: "authed", user: res.user });
      },
      startDemo: async () => {
        const res = await startDemoRequest();
        queryClient.clear();
        setSession({ status: "authed", user: res.user });
      },
      logout: async () => {
        try {
          await logoutRequest();
        } finally {
          // 서버 호출이 실패해도 이 브라우저에서는 로그아웃 상태로 만든다
          setSession({ status: "guest", user: null });
          queryClient.clear();
        }
      },
    }),
    [session, queryClient],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다");
  return value;
}
