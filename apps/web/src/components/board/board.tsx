"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createApplication, listApplications, listTags, moveApplication } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
  type CreateApplicationInput,
} from "@/lib/types";
import { Button } from "../ui/button";
import { ErrorBanner, FullPageSpinner } from "../ui/feedback";
import { INPUT_CLASS } from "../ui/text-field";
import { CardPreview } from "./card";
import { Column } from "./column";
import { columnDroppableId, findColumn, flattenColumns, groupByStatus, type Columns } from "./columns";
import { CreateApplicationDialog } from "./create-application-dialog";

/** 검색어·태그별로 캐시를 나눈다. 무효화는 ["applications"] 전체로 한다 */
const listKey = (q: string, tagId: string | null) => ["applications", { q, tagId }] as const;

type DragState = {
  id: string;
  /** 드래그를 시작한 위치. 제자리에 놓으면 요청을 보내지 않기 위해 */
  from: { status: ApplicationStatus; index: number };
  /** 드래그 중에만 쓰는 화면용 컬럼 상태 */
  columns: Columns;
};

type MoveVars = {
  id: string;
  status: ApplicationStatus;
  index: number;
  /** 실패 시 되돌릴 목록 */
  previous?: Application[];
};

export function Board() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tagId, setTagId] = useState<string | null>(null);
  const q = useDebouncedValue(search.trim(), 250);
  const queryKey = listKey(q, tagId);

  const applications = useQuery({
    queryKey,
    queryFn: ({ signal }) => listApplications({ q: q || undefined, tagId: tagId ?? undefined }, signal),
  });

  const tags = useQuery({ queryKey: ["tags"], queryFn: ({ signal }) => listTags(signal) });

  const serverColumns = useMemo(() => groupByStatus(applications.data ?? []), [applications.data]);
  const byId = useMemo(
    () => new Map((applications.data ?? []).map((application) => [application.id, application])),
    [applications.data],
  );

  const [drag, setDrag] = useState<DragState | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dialogStatus, setDialogStatus] = useState<ApplicationStatus | null>(null);

  // 드래그 중에는 화면용 상태를, 그 외에는 서버(낙관적 업데이트 포함) 상태를 그린다
  const columns = drag?.columns ?? serverColumns;

  const sensors = useSensors(
    // 4px 이상 움직여야 드래그로 본다 (가벼운 클릭은 상세로 이동)
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = useMutation<Application, Error, MoveVars>({
    mutationFn: ({ id, status, index }) => moveApplication(id, { status, index }),
    onMutate: async () => {
      // 진행 중인 목록 요청이 낙관적 업데이트를 덮어쓰지 않게 한다
      await queryClient.cancelQueries({ queryKey });
    },
    onError: (error, variables) => {
      if (variables.previous) queryClient.setQueryData(queryKey, variables.previous);
      setMoveError(error.message);
    },
    onSuccess: () => setMoveError(null),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const create = useMutation<Application, Error, CreateApplicationInput>({
    mutationFn: createApplication,
    onSuccess: () => {
      setDialogStatus(null);
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const status = findColumn(serverColumns, id);
    if (!status) return;
    setMoveError(null);
    setDrag({
      id,
      from: { status, index: serverColumns[status].findIndex((app) => app.id === id) },
      columns: serverColumns,
    });
  }

  /** 다른 컬럼 위로 넘어가면 미리 옮겨서 보여준다 (컬럼 안 순서는 sortable이 처리) */
  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    setDrag((prev) => {
      if (!prev) return prev;
      const from = findColumn(prev.columns, activeId);
      const to = findColumn(prev.columns, overId);
      if (!from || !to || from === to) return prev;

      const moving = prev.columns[from].find((app) => app.id === activeId);
      if (!moving) return prev;

      const target = prev.columns[to];
      const overIndex =
        overId === columnDroppableId(to) ? target.length : target.findIndex((app) => app.id === overId);
      const insertAt = overIndex < 0 ? target.length : overIndex;

      return {
        ...prev,
        columns: {
          ...prev.columns,
          [from]: prev.columns[from].filter((app) => app.id !== activeId),
          [to]: [...target.slice(0, insertAt), moving, ...target.slice(insertAt)],
        },
      };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const current = drag;
    setDrag(null);
    if (!current || !event.over) return;

    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const status = findColumn(current.columns, activeId);
    if (!status) return;

    let next = current.columns;
    // 같은 컬럼 안에서 순서만 바꾼 경우
    if (findColumn(next, overId) === status && overId !== activeId) {
      const list = next[status];
      const fromIndex = list.findIndex((app) => app.id === activeId);
      const toIndex = list.findIndex((app) => app.id === overId);
      if (fromIndex >= 0 && toIndex >= 0) next = { ...next, [status]: arrayMove(list, fromIndex, toIndex) };
    }

    const index = next[status].findIndex((app) => app.id === activeId);
    if (index < 0) return;
    if (status === current.from.status && index === current.from.index) return; // 제자리

    const previous = queryClient.getQueryData<Application[]>(queryKey);
    // 드래그 상태를 지우기 전에 결과를 캐시에 먼저 반영해서 카드가 되돌아가 보이지 않게 한다
    queryClient.setQueryData(queryKey, flattenColumns(next));
    move.mutate({ id: activeId, status, index, previous });
  }

  const total = applications.data?.length ?? 0;
  const activeApplication = drag ? byId.get(drag.id) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="회사·직무 검색"
          aria-label="회사·직무 검색"
          className={`${INPUT_CLASS} w-auto min-w-0 flex-1 sm:max-w-xs`}
        />
        <span className="text-sm text-muted">{total}개</span>
        <Button onClick={() => setDialogStatus("INTERESTED")} className="ml-auto shrink-0">
          + 지원 추가
        </Button>
      </div>

      {tags.data && tags.data.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">태그</span>
          {tags.data.map((tag) => {
            const on = tagId === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTagId(on ? null : tag.id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  on
                    ? "border-accent bg-accent-soft font-medium text-foreground"
                    : "border-border text-muted hover:border-accent"
                }`}
              >
                {tag.name}{" "}
                <span className="text-[10px] text-muted">{tag._count.applications}</span>
              </button>
            );
          })}
          {tagId ? (
            <button type="button" onClick={() => setTagId(null)} className="text-xs text-accent underline">
              필터 해제
            </button>
          ) : null}
        </div>
      ) : null}

      {moveError ? <ErrorBanner message={moveError} /> : null}
      {applications.isError ? (
        <ErrorBanner
          message={applications.error.message}
          onRetry={() => {
            void applications.refetch();
          }}
        />
      ) : null}

      {applications.isPending ? (
        <FullPageSpinner label="보드를 불러오는 중" />
      ) : (
        <>
          {total === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted">
              {q || tagId
                ? "조건에 맞는 지원이 없습니다."
                : "아직 등록한 지원이 없습니다. 오른쪽 위 '+ 지원 추가'로 첫 카드를 만들어 보세요."}
            </p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDrag(null)}
          >
            <div className="-mx-4 overflow-x-auto px-4 pb-4">
              <div className="flex min-w-max gap-3">
                {APPLICATION_STATUSES.map((status) => (
                  <Column
                    key={status}
                    status={status}
                    applications={columns[status]}
                    onAdd={() => setDialogStatus(status)}
                  />
                ))}
              </div>
            </div>

            <DragOverlay>
              {activeApplication ? <CardPreview application={activeApplication} /> : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      <CreateApplicationDialog
        status={dialogStatus}
        pending={create.isPending}
        error={create.error?.message ?? null}
        onClose={() => {
          setDialogStatus(null);
          create.reset();
        }}
        onSubmit={(input) => create.mutate(input)}
      />
    </div>
  );
}
