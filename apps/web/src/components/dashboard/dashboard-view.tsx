"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getDashboard } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { INTERVIEW_TYPE_LABEL, IN_PROGRESS_STATUSES, STATUS_META } from "@/lib/status";
import { APPLICATION_STATUSES, type Dashboard } from "@/lib/types";
import { ErrorBanner, FullPageSpinner } from "../ui/feedback";

export function DashboardView() {
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: ({ signal }) => getDashboard(signal) });

  if (dashboard.isPending) return <FullPageSpinner label="대시보드를 불러오는 중" />;
  if (dashboard.isError) {
    return (
      <ErrorBanner
        message={dashboard.error.message}
        onRetry={() => {
          void dashboard.refetch();
        }}
      />
    );
  }

  const { total, statusCounts, upcomingInterviews } = dashboard.data;
  const inProgress = IN_PROGRESS_STATUSES.reduce((sum, status) => sum + statusCounts[status], 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <Link href="/board" className="text-sm text-accent underline">
          보드로 →
        </Link>
      </div>

      <section aria-label="요약" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="전체 지원" value={total} />
        <StatTile label="진행 중" value={inProgress} hint="지원~최종" />
        <StatTile label="합격" value={statusCounts.OFFER} />
        <StatTile label="다가오는 면접" value={upcomingInterviews.length} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusBreakdown statusCounts={statusCounts} total={total} />
        <UpcomingInterviews interviews={upcomingInterviews} />
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </div>
  );
}

/** 상태별 건수. 막대는 보조 수단이고, 이름과 숫자를 항상 함께 보여준다 */
function StatusBreakdown({
  statusCounts,
  total,
}: {
  statusCounts: Dashboard["statusCounts"];
  total: number;
}) {
  const max = Math.max(1, ...APPLICATION_STATUSES.map((status) => statusCounts[status]));

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">상태별 지원</h2>

      {total === 0 ? (
        <p className="text-xs text-muted">아직 등록한 지원이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {APPLICATION_STATUSES.map((status) => {
            const count = statusCounts[status];
            const meta = STATUS_META[status];
            const share = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li
                key={status}
                title={`${meta.label} · ${count}건 (${share}%)`}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-md px-1 py-0.5 transition hover:bg-accent-soft"
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
                  {meta.label}
                </span>
                <span className="h-2 rounded-full bg-accent-soft" aria-hidden>
                  {count > 0 ? (
                    <span
                      className={`block h-2 rounded-r-[4px] ${meta.dot}`}
                      style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                    />
                  ) : null}
                </span>
                <span className="text-right text-sm tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function UpcomingInterviews({ interviews }: { interviews: Dashboard["upcomingInterviews"] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">다가오는 면접</h2>

      {interviews.length === 0 ? (
        <p className="text-xs text-muted">예정된 면접이 없습니다. 상세 화면에서 일정을 추가할 수 있어요.</p>
      ) : (
        <ul className="flex flex-col">
          {interviews.map((interview) => (
            <li key={interview.id} className="border-b border-border py-3 first:pt-0 last:border-0 last:pb-0">
              <Link
                href={`/applications/${interview.application.id}`}
                className="flex flex-col gap-1 rounded-md transition hover:opacity-80"
              >
                <span className="text-sm font-medium">{formatDateTime(interview.scheduledAt)}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span className="font-medium text-foreground">{interview.application.companyName}</span>
                  {interview.application.position}
                  <span className="rounded-full bg-accent-soft px-2 py-0.5">
                    {INTERVIEW_TYPE_LABEL[interview.type]}
                  </span>
                  {interview.location ? <span>{interview.location}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
