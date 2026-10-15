"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRef } from "react";
import { formatDate, formatMonthDay } from "@/lib/format";
import type { Application } from "@/lib/types";

const CARD_CLASS = "flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-left shadow-sm";

/** 드래그로 끝난 포인터는 클릭(상세 이동)으로 보지 않는다 */
const CLICK_SLOP_PX = 4;

function CardContent({ application }: { application: Application }) {
  const counts = application._count;

  return (
    <>
      <Link href={`/applications/${application.id}`} className="flex flex-col gap-0.5">
        <span className="text-sm font-medium leading-tight">{application.companyName}</span>
        <span className="text-xs text-muted">{application.position}</span>
      </Link>

      {application.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {application.tags.map(({ tag }) => (
            <span
              key={tag.id}
              className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-foreground"
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {application.nextInterview ? (
        <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          면접 {formatMonthDay(application.nextInterview.scheduledAt)}
        </span>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        {application.appliedAt ? <span>지원 {formatDate(application.appliedAt)}</span> : null}
        {counts.interviews > 0 ? <span>면접 {counts.interviews}</span> : null}
        {counts.notes > 0 ? <span>메모 {counts.notes}</span> : null}
      </div>
    </>
  );
}

export function SortableCard({ application }: { application: Application }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
    data: { status: application.status },
  });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // 캡처 단계에서 처리하면 dnd-kit의 리스너를 덮어쓰지 않는다
      onPointerDownCapture={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onClickCapture={(event) => {
        const start = pointerStart.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className={`${CARD_CLASS} cursor-grab touch-none transition hover:border-accent ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <CardContent application={application} />
    </div>
  );
}

/** 드래그 중 포인터를 따라다니는 카드 (DragOverlay용) */
export function CardPreview({ application }: { application: Application }) {
  return (
    <div className={`${CARD_CLASS} cursor-grabbing border-accent shadow-lg`}>
      <CardContent application={application} />
    </div>
  );
}
