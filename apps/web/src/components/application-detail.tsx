"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deleteApplication,
  getApplication,
  getTimeline,
  moveApplication,
  updateApplication,
} from "@/lib/api";
import { formatDate, formatDateTime, fromDateInputValue, toDateInputValue } from "@/lib/format";
import { text, textOrNull } from "@/lib/form";
import { STATUS_META } from "@/lib/status";
import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationDetail as ApplicationDetailData,
  type ApplicationStatus,
  type StatusHistoryEntry,
  type UpdateApplicationInput,
} from "@/lib/types";
import { InterviewsSection } from "./application/interviews-section";
import { NotesSection } from "./application/notes-section";
import { TagsSection } from "./application/tags-section";
import { Button } from "./ui/button";
import { ErrorBanner, ErrorText, FullPageSpinner, Spinner } from "./ui/feedback";
import { Modal } from "./ui/modal";
import { TextField } from "./ui/text-field";

/** 상태를 바꿀 때는 그 컬럼 맨 아래로 보낸다 (서버가 컬럼 길이로 잘라준다) */
const END_OF_COLUMN = 9999;

export function ApplicationDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detail = useQuery({
    queryKey: ["application", id],
    queryFn: ({ signal }) => getApplication(id, signal),
  });
  const timeline = useQuery({
    queryKey: ["application", id, "timeline"],
    queryFn: ({ signal }) => getTimeline(id, signal),
  });

  /** 상세·타임라인과 보드 목록을 함께 새로 고친다 */
  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["application", id] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
  }

  const update = useMutation<Application, Error, UpdateApplicationInput>({
    mutationFn: (input) => updateApplication(id, input),
    onSuccess: invalidate,
  });

  const move = useMutation<Application, Error, ApplicationStatus>({
    mutationFn: (status) => moveApplication(id, { status, index: END_OF_COLUMN }),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, void>({
    mutationFn: () => deleteApplication(id),
    onSuccess: () => {
      setConfirmDelete(false);
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      // 이 화면은 Activity로 아직 마운트된 상태라, 캐시를 지우면 곧바로 다시 요청해 404가 난다.
      // 지우지 않고 보드로 이동만 한다 (상세 캐시는 쓰이지 않다가 정리된다)
      router.replace("/board");
    },
  });

  if (detail.isPending) return <FullPageSpinner label="지원 내역을 불러오는 중" />;

  if (detail.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorBanner
          message={detail.error.message}
          onRetry={() => {
            void detail.refetch();
          }}
        />
        <Link href="/board" className="text-sm text-accent underline">
          보드로 돌아가기
        </Link>
      </div>
    );
  }

  const application = detail.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href="/board" className="text-sm text-muted">
            ← 보드
          </Link>
          <h1 className="truncate text-2xl font-bold tracking-tight">{application.companyName}</h1>
          <p className="text-sm text-muted">{application.position}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusSelect
            value={application.status}
            pending={move.isPending}
            onChange={(status) => move.mutate(status)}
          />
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            삭제
          </Button>
        </div>
      </div>

      {move.isError ? <ErrorText message={move.error.message} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">정보</h2>
          <EditForm
            application={application}
            pending={update.isPending}
            error={update.error?.message ?? null}
            saved={update.isSuccess && !update.isPending}
            onSubmit={(input) => update.mutate(input)}
          />
        </section>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">타임라인</h2>
            {timeline.isPending ? (
              <Spinner />
            ) : timeline.isError ? (
              <ErrorText message={timeline.error.message} />
            ) : (
              <Timeline entries={timeline.data} />
            )}
          </section>

          <TagsSection applicationId={id} tags={application.tags} />

          <InterviewsSection applicationId={id} interviews={application.interviews} />

          <NotesSection applicationId={id} notes={application.notes} />
        </div>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="이 지원을 삭제할까요?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {application.companyName} · {application.position} 카드와 타임라인·면접·메모가 모두 지워집니다.
            되돌릴 수 없습니다.
          </p>
          {remove.isError ? <ErrorText message={remove.error.message} /> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>
              취소
            </Button>
            <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "삭제 중…" : "삭제"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatusSelect({
  value,
  pending,
  onChange,
}: {
  value: ApplicationStatus;
  pending: boolean;
  onChange: (status: ApplicationStatus) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">상태</span>
      <select
        value={value}
        disabled={pending}
        onChange={(event) => onChange(event.target.value as ApplicationStatus)}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
      >
        {APPLICATION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_META[status].label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditForm({
  application,
  pending,
  error,
  saved,
  onSubmit,
}: {
  application: ApplicationDetailData;
  pending: boolean;
  error: string | null;
  saved: boolean;
  onSubmit: (input: UpdateApplicationInput) => void;
}) {
  return (
    <form
      // 저장 후 서버 값으로 입력칸을 다시 채운다
      key={application.updatedAt}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({
          companyName: text(form.get("companyName")),
          position: text(form.get("position")),
          jobUrl: textOrNull(form.get("jobUrl")),
          appliedAt: fromDateInputValue(text(form.get("appliedAt"))),
          salaryNote: textOrNull(form.get("salaryNote")),
        });
      }}
      className="flex flex-col gap-4"
    >
      <TextField label="회사" name="companyName" defaultValue={application.companyName} required maxLength={100} />
      <TextField label="직무" name="position" defaultValue={application.position} required maxLength={100} />
      <TextField
        label="공고 URL"
        name="jobUrl"
        type="url"
        defaultValue={application.jobUrl ?? ""}
        placeholder="https://example.com/jobs/123"
        maxLength={2000}
      />
      <TextField
        label="지원일"
        name="appliedAt"
        type="date"
        defaultValue={toDateInputValue(application.appliedAt)}
      />
      <TextField
        label="연봉 메모"
        name="salaryNote"
        defaultValue={application.salaryNote ?? ""}
        placeholder="희망 6,000 / 현재 협의"
        maxLength={200}
      />

      {application.jobUrl ? (
        <a
          href={application.jobUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm text-accent underline"
        >
          공고 열기 ↗
        </a>
      ) : null}

      {error ? <ErrorText message={error} /> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
        {saved ? <span className="text-xs text-muted">저장했습니다</span> : null}
        <span className="ml-auto text-xs text-muted">등록 {formatDate(application.createdAt)}</span>
      </div>
    </form>
  );
}

function Timeline({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) return <p className="text-xs text-muted">아직 변경 이력이 없습니다.</p>;

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5 text-sm">
            {entry.fromStatus ? (
              <>
                <StatusChip status={entry.fromStatus} />
                <span className="text-muted">→</span>
              </>
            ) : (
              <span className="text-muted">등록</span>
            )}
            <StatusChip status={entry.toStatus} />
          </span>
          <span className="text-xs text-muted">{formatDateTime(entry.changedAt)}</span>
        </li>
      ))}
    </ol>
  );
}

function StatusChip({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.chip}`}>{meta.label}</span>;
}
