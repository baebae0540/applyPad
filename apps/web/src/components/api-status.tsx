"use client";

import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api";

type State = "checking" | "ok" | "db-down" | "unreachable";

const LABEL: Record<State, string> = {
  checking: "API 확인 중",
  ok: "API · DB 연결됨",
  "db-down": "API 연결됨 · DB 응답 없음",
  unreachable: "API에 연결할 수 없음",
};

const DOT: Record<State, string> = {
  checking: "bg-muted animate-pulse",
  ok: "bg-emerald-500",
  "db-down": "bg-amber-500",
  unreachable: "bg-red-500",
};

/** 로컬 개발 중 web ↔ api ↔ db 연결 상태를 보여준다 (CORS 포함 확인) */
export function ApiStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((h) => setState(h.status === "ok" ? "ok" : "db-down"))
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setState("unreachable");
      });
    return () => controller.abort();
  }, []);

  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
    >
      <span className={`size-2 rounded-full ${DOT[state]}`} aria-hidden />
      {LABEL[state]}
    </span>
  );
}
