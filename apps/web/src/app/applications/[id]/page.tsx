import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicationDetail } from "@/components/application-detail";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/require-auth";
import { FullPageSpinner } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "지원 상세" };

export default function ApplicationPage({ params }: PageProps<"/applications/[id]">) {
  // params는 요청 시점에 정해진다. Suspense 안에서 풀어야 나머지가 정적으로 미리 렌더된다
  return (
    <Suspense fallback={<FullPageSpinner />}>
      {params.then(({ id }) => (
        <RequireAuth next={`/applications/${id}`}>
          <AppHeader />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
            <ApplicationDetail id={id} />
          </main>
        </RequireAuth>
      ))}
    </Suspense>
  );
}
