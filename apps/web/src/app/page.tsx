import { ApiStatus } from "@/components/api-status";
import { LandingCta } from "@/components/landing-cta";

const COLUMNS = [
  { name: "관심", cards: ["A사 · 백엔드"] },
  { name: "지원", cards: ["B사 · 풀스택", "C사 · 웹"] },
  { name: "서류 통과", cards: ["D사 · 백엔드"] },
  { name: "면접", cards: ["E사 · 1차 10/21"] },
  { name: "최종", cards: [] },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-12 sm:px-6 sm:py-20">
      <header className="flex items-center justify-between gap-4">
        <span className="text-lg font-semibold tracking-tight">applypad</span>
        <ApiStatus />
      </header>

      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          지원부터 합격까지,
          <br />
          이직 준비를 한 판에.
        </h1>
        <p className="max-w-xl text-base text-muted sm:text-lg">
          지원 현황을 칸반으로 옮기고, 면접 일정과 회사별 메모를 한 곳에 모아두세요.
          상태가 바뀔 때마다 타임라인이 자동으로 쌓입니다.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <LandingCta />
        </div>
      </section>

      <section aria-label="칸반 미리보기" className="overflow-x-auto pb-2">
        <div className="grid min-w-[640px] grid-cols-5 gap-3">
          {COLUMNS.map((col) => (
            <div key={col.name} className="flex flex-col gap-2 rounded-xl bg-accent-soft p-3">
              <div className="flex items-center justify-between text-sm font-medium">
                {col.name}
                <span className="text-xs text-muted">{col.cards.length}</span>
              </div>
              {col.cards.map((card) => (
                <div
                  key={card}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm"
                >
                  {card}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
