"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/button";

export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/board" className="text-base font-semibold tracking-tight">
          applypad
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/board" className="rounded-md px-2 py-1 text-muted transition hover:bg-accent-soft hover:text-foreground">
            보드
          </Link>
          <Link href="/dashboard" className="rounded-md px-2 py-1 text-muted transition hover:bg-accent-soft hover:text-foreground">
            대시보드
          </Link>
        </nav>
        {user ? (
          <span className="ml-auto max-w-[40vw] truncate text-sm text-muted" title={user.email}>
            {user.name ?? user.email}
          </span>
        ) : null}
        <Button variant="ghost" onClick={onLogout} disabled={pending} className="shrink-0">
          로그아웃
        </Button>
      </div>
    </header>
  );
}
