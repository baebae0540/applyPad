import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { Board } from "@/components/board/board";
import { RequireAuth } from "@/components/require-auth";

export const metadata: Metadata = { title: "보드" };

export default function BoardPage() {
  return (
    <RequireAuth next="/board">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Board />
      </main>
    </RequireAuth>
  );
}
