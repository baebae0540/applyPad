"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { createTag, deleteTag, listTags, setApplicationTags, updateTag } from "@/lib/api";
import { text } from "@/lib/form";
import type { Tag, TagWithCount, UpdateTagInput } from "@/lib/types";
import { Button } from "../ui/button";
import { ErrorText, Spinner } from "../ui/feedback";
import { TagColorPicker } from "../ui/tag-color-picker";
import { TagDot } from "../ui/tag-dot";
import { INPUT_CLASS } from "../ui/text-field";

type Mode = "add" | "manage" | null;

/** 태그 정보는 카드·상세에 함께 실려 오므로 태그가 바뀌면 전부 무효화한다 */
function invalidateTagData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["tags"] });
  void queryClient.invalidateQueries({ queryKey: ["applications"] });
  void queryClient.invalidateQueries({ queryKey: ["application"] });
}

export function TagsSection({
  applicationId,
  tags,
}: {
  applicationId: string;
  tags: { tag: Tag }[];
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [newColor, setNewColor] = useState<string | null>(null);
  const selected = new Set(tags.map(({ tag }) => tag.id));

  // Activity로 화면이 보존되므로, 다른 지원으로 넘어가면 열려 있던 입력창을 닫는다
  const [prevApplicationId, setPrevApplicationId] = useState(applicationId);
  if (prevApplicationId !== applicationId) {
    setPrevApplicationId(applicationId);
    setMode(null);
  }

  const myTags = useQuery({ queryKey: ["tags"], queryFn: ({ signal }) => listTags(signal) });

  const apply = useMutation<unknown, Error, string[]>({
    mutationFn: (tagIds) => setApplicationTags(applicationId, tagIds),
    onSuccess: () => invalidateTagData(queryClient),
  });

  /** 새 태그를 만들고 바로 이 지원에 붙인다 */
  const addNew = useMutation<Tag, Error, { name: string; color: string | null }>({
    mutationFn: async (input) => {
      const tag = await createTag(input);
      await setApplicationTags(applicationId, [...selected, tag.id]);
      return tag;
    },
    onSuccess: () => {
      setMode(null);
      setNewColor(null);
      invalidateTagData(queryClient);
    },
  });

  function toggle(tagId: string) {
    const next = new Set(selected);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    apply.mutate([...next]);
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = text(new FormData(event.currentTarget).get("name"));
    if (name) addNew.mutate({ name, color: newColor });
  }

  function switchMode(next: Mode) {
    setMode((current) => (current === next ? null : next));
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">태그</h2>
        <div className="flex gap-1">
          {myTags.data && myTags.data.length > 0 ? (
            <Button
              variant="ghost"
              onClick={() => switchMode("manage")}
              aria-pressed={mode === "manage"}
              className="px-2 py-1 text-xs"
            >
              {mode === "manage" ? "관리 닫기" : "관리"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => switchMode("add")} className="px-2 py-1 text-xs">
            {mode === "add" ? "닫기" : "+ 새 태그"}
          </Button>
        </div>
      </div>

      {mode === "add" ? (
        <form onSubmit={onCreate} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              name="name"
              placeholder="예: 원격근무"
              maxLength={30}
              required
              autoFocus
              aria-label="새 태그 이름"
              className={INPUT_CLASS}
            />
            <Button type="submit" disabled={addNew.isPending} className="shrink-0 px-3 py-1.5 text-xs">
              {addNew.isPending ? "추가 중…" : "추가"}
            </Button>
          </div>
          <TagColorPicker value={newColor} onChange={setNewColor} label="새 태그 색" />
        </form>
      ) : null}

      {myTags.isPending ? (
        <Spinner />
      ) : myTags.isError ? (
        <ErrorText message={myTags.error.message} />
      ) : myTags.data.length === 0 ? (
        <p className="text-xs text-muted">아직 태그가 없습니다. &apos;+ 새 태그&apos;로 만들어 보세요.</p>
      ) : mode === "manage" ? (
        <ul className="flex flex-col divide-y divide-border">
          {myTags.data.map((tag) => (
            <ManageTagRow key={tag.id} tag={tag} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {myTags.data.map((tag) => {
            const on = selected.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={apply.isPending}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                  on
                    ? "border-accent bg-accent-soft font-medium text-foreground"
                    : "border-border text-muted hover:border-accent"
                }`}
              >
                <TagDot color={tag.color} />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      {apply.isError ? <ErrorText message={apply.error.message} /> : null}
      {addNew.isError ? <ErrorText message={addNew.error.message} /> : null}
    </section>
  );
}

/** 관리 모드의 한 줄: 색은 고르는 즉시, 이름은 포커스를 벗어날 때 저장한다 */
function ManageTagRow({ tag }: { tag: TagWithCount }) {
  const queryClient = useQueryClient();
  const nameRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = useMutation<Tag, Error, UpdateTagInput>({
    mutationFn: (input) => updateTag(tag.id, input),
    onSuccess: (saved) => {
      // 다시 불러오기 전에 옛 값이 잠깐 보이지 않도록 목록 캐시를 먼저 고친다
      queryClient.setQueryData<TagWithCount[]>(["tags"], (list) =>
        list?.map((item) => (item.id === saved.id ? { ...item, name: saved.name, color: saved.color } : item)),
      );
      invalidateTagData(queryClient);
    },
    onError: (_error, input) => {
      // 이름 저장이 실패하면(중복 등) 입력값을 원래 이름으로 되돌린다
      if (input.name !== undefined && nameRef.current) nameRef.current.value = tag.name;
    },
  });

  const remove = useMutation<void, Error, void>({
    mutationFn: () => deleteTag(tag.id),
    onSuccess: () => invalidateTagData(queryClient),
    onSettled: () => setConfirmDelete(false),
  });

  function saveName() {
    const name = nameRef.current?.value.trim() ?? "";
    if (!name) {
      if (nameRef.current) nameRef.current.value = tag.name;
      return;
    }
    if (name !== tag.name) update.mutate({ name });
  }

  const usage = tag._count.applications;
  // 저장하는 동안에도 고른 색이 바로 보이도록 요청 중인 값을 먼저 쓴다
  const shownColor =
    update.isPending && update.variables.color !== undefined ? update.variables.color : tag.color;

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2">
        <TagDot color={shownColor} className="size-2.5" />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            nameRef.current?.blur();
          }}
          className="min-w-0 flex-1"
        >
          <input
            ref={nameRef}
            defaultValue={tag.name}
            maxLength={30}
            onBlur={saveName}
            aria-label={`'${tag.name}' 태그 이름`}
            className={`${INPUT_CLASS} py-1 text-xs`}
          />
        </form>
        <span className="shrink-0 text-[11px] text-muted">{usage}건</span>
        {confirmDelete ? (
          <>
            <Button
              variant="danger"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="shrink-0 px-2 py-1 text-xs"
            >
              {remove.isPending ? "삭제 중…" : "삭제 확인"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} className="shrink-0 px-2 py-1 text-xs">
              취소
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            title={usage > 0 ? `지원 ${usage}건에서 떼어집니다` : undefined}
            className="shrink-0 px-2 py-1 text-xs"
          >
            삭제
          </Button>
        )}
      </div>
      <TagColorPicker
        value={shownColor}
        onChange={(color) => update.mutate({ color })}
        disabled={update.isPending}
        label={`'${tag.name}' 태그 색`}
      />
      {update.isError ? <ErrorText message={update.error.message} /> : null}
      {remove.isError ? <ErrorText message={remove.error.message} /> : null}
    </li>
  );
}
