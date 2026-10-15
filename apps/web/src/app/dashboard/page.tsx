import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { RequireAuth } from "@/components/require-auth";

export const metadata: Metadata = { title: "대시보드" };

export default function DashboardPage() {
  return (
    <RequireAuth next="/dashboard">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <DashboardView />
      </main>
    </RequireAuth>
  );
}
