"use client";

import { fromDateInputValue } from "@/lib/format";
import { text, textOrNull } from "@/lib/form";
import { STATUS_META } from "@/lib/status";
import type { ApplicationStatus, CreateApplicationInput } from "@/lib/types";
import { Button } from "../ui/button";
import { ErrorText } from "../ui/feedback";
import { Modal } from "../ui/modal";
import { TextField } from "../ui/text-field";

export function CreateApplicationDialog({
  status,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  /** null이면 닫힌 상태. 값이 있으면 그 컬럼에 추가한다 */
  status: ApplicationStatus | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: CreateApplicationInput) => void;
}) {
  return (
    <Modal
      open={status !== null}
      onClose={onClose}
      title={status ? `${STATUS_META[status].label}에 지원 추가` : "지원 추가"}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!status) return;
          const form = new FormData(event.currentTarget);
          onSubmit({
            companyName: text(form.get("companyName")),
            position: text(form.get("position")),
            status,
            jobUrl: textOrNull(form.get("jobUrl")),
            appliedAt: fromDateInputValue(text(form.get("appliedAt"))),
            salaryNote: textOrNull(form.get("salaryNote")),
          });
        }}
        className="flex flex-col gap-4"
      >
        <TextField label="회사" name="companyName" placeholder="토스" required maxLength={100} autoFocus />
        <TextField label="직무" name="position" placeholder="백엔드 개발자" required maxLength={100} />
        <TextField
          label="공고 URL (선택)"
          name="jobUrl"
          type="url"
          placeholder="https://example.com/jobs/123"
          maxLength={2000}
        />
        <TextField label="지원일 (선택)" name="appliedAt" type="date" />
        <TextField
          label="연봉 메모 (선택)"
          name="salaryNote"
          placeholder="희망 6,000 / 현재 협의"
          maxLength={200}
        />

        {error ? <ErrorText message={error} /> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "추가 중…" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
