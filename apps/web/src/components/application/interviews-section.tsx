"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createInterview, deleteInterview, updateInterview } from "@/lib/api";
import { formatDateTime, fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/format";
import { text, textOrNull } from "@/lib/form";
import { INTERVIEW_RESULT_META, INTERVIEW_TYPE_LABEL } from "@/lib/status";
import type {
  CreateInterviewInput,
  Interview,
  InterviewResult,
  InterviewType,
} from "@/lib/types";
import { Button } from "../ui/button";
import { ErrorText } from "../ui/feedback";
import { Modal } from "../ui/modal";
import { SelectField } from "../ui/select-field";
import { TextField } from "../ui/text-field";
import { TextareaField } from "../ui/textarea-field";

const TYPES: InterviewType[] = ["PHONE", "VIDEO", "ONSITE", "CODING_TEST", "OTHER"];
const RESULTS: InterviewResult[] = ["PENDING", "PASSED", "FAILED"];

export function InterviewsSection({
  applicationId,
  interviews,
}: {
  applicationId: string;
  interviews: Interview[];
}) {
  const queryClient = useQueryClient();
  /** null이면 닫힘, "new"면 추가, 면접 객체면 수정 */
  const [editing, setEditing] = useState<Interview | "new" | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const save = useMutation<Interview, Error, { id?: string; input: CreateInterviewInput }>({
    mutationFn: ({ id, input }) =>
      id ? updateInterview(applicationId, id, input) : createInterview(applicationId, input),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (id) => deleteInterview(applicationId, id),
    onSuccess: invalidate,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scheduledAt = fromDateTimeInputValue(text(form.get("scheduledAt")));
    if (!scheduledAt) return;
    save.mutate({
      id: editing !== "new" && editing ? editing.id : undefined,
      input: {
        scheduledAt,
        type: text(form.get("type")) as InterviewType,
        result: text(form.get("result")) as InterviewResult,
        location: textOrNull(form.get("location")),
        memo: textOrNull(form.get("memo")),
      },
    });
  }

  const current = editing === "new" ? null : editing;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">면접 일정</h2>
        <Button variant="ghost" onClick={() => setEditing("new")} className="px-2 py-1 text-xs">
          + 추가
        </Button>
      </div>

      {interviews.length === 0 ? (
        <p className="text-xs text-muted">등록된 면접이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {interviews.map((interview) => {
            const result = INTERVIEW_RESULT_META[interview.result];
            return (
              <li key={interview.id} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{formatDateTime(interview.scheduledAt)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${result.chip}`}>
                    {result.label}
                  </span>
                </div>
                <span className="text-xs text-muted">
                  {INTERVIEW_TYPE_LABEL[interview.type]}
                  {interview.location ? ` · ${interview.location}` : ""}
                </span>
                {interview.memo ? (
                  <p className="whitespace-pre-line text-sm text-muted">{interview.memo}</p>
                ) : null}
                <div className="flex gap-1">
                  <Button variant="ghost" onClick={() => setEditing(interview)} className="px-2 py-1 text-xs">
                    수정
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => remove.mutate(interview.id)}
                    disabled={remove.isPending}
                    className="px-2 py-1 text-xs"
                  >
                    삭제
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {remove.isError ? <ErrorText message={remove.error.message} /> : null}

      <Modal
        open={editing !== null}
        onClose={() => {
          setEditing(null);
          save.reset();
        }}
        title={current ? "면접 수정" : "면접 추가"}
      >
        <form key={current?.id ?? "new"} onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField
            label="일시"
            name="scheduledAt"
            type="datetime-local"
            defaultValue={toDateTimeInputValue(current?.scheduledAt)}
            required
            autoFocus
          />
          <SelectField label="유형" name="type" defaultValue={current?.type ?? "OTHER"}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {INTERVIEW_TYPE_LABEL[type]}
              </option>
            ))}
          </SelectField>
          <SelectField label="결과" name="result" defaultValue={current?.result ?? "PENDING"}>
            {RESULTS.map((result) => (
              <option key={result} value={result}>
                {INTERVIEW_RESULT_META[result].label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="장소 (선택)"
            name="location"
            defaultValue={current?.location ?? ""}
            placeholder="강남역 10번 출구 / 화상 링크"
            maxLength={200}
          />
          <TextareaField
            label="메모 (선택)"
            name="memo"
            defaultValue={current?.memo ?? ""}
            placeholder="1차 기술 면접, 코드 리뷰 위주"
            maxLength={2000}
          />

          {save.isError ? <ErrorText message={save.error.message} /> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)} disabled={save.isPending}>
              취소
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
