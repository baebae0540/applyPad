"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { STATUS_META } from "@/lib/status";
import type { Application, ApplicationStatus } from "@/lib/types";
import { SortableCard } from "./card";
import { columnDroppableId } from "./columns";

export function Column({
  status,
  applications,
  onAdd,
}: {
  status: ApplicationStatus;
  applications: Application[];
  onAdd: () => void;
}) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(status), data: { status } });

  return (
    <section
      ref={setNodeRef}
      aria-label={meta.label}
      className={`flex w-64 shrink-0 flex-col gap-2 rounded-xl border p-3 transition ${
        isOver ? "border-accent bg-accent-soft" : "border-transparent bg-accent-soft/50"
      }`}
    >
      <header className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
        <h2 className="text-sm font-semibold">{meta.label}</h2>
        <span className="ml-auto text-xs text-muted">{applications.length}</span>
      </header>

      <SortableContext items={applications.map((app) => app.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-20 flex-col gap-2">
          {applications.map((application) => (
            <SortableCard key={application.id} application={application} />
          ))}
          {applications.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
              여기로 끌어다 놓기
            </p>
          ) : null}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg px-3 py-2 text-xs text-muted transition hover:bg-surface hover:text-foreground"
      >
        + 추가
      </button>
    </section>
  );
}
