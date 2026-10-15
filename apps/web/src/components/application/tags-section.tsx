"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createTag, listTags, setApplicationTags } from "@/lib/api";
import { text } from "@/lib/form";
import type { Tag } from "@/lib/types";
import { Button } from "../ui/button";
import { ErrorText, Spinner } from "../ui/feedback";
import { INPUT_CLASS } from "../ui/text-field";

export function TagsSection({
  applicationId,
  tags,
}: {
  applicationId: string;
  tags: { tag: Tag }[];
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const selected = new Set(tags.map(({ tag }) => tag.id));

  const myTags = useQuery({ queryKey: ["tags"], queryFn: ({ signal }) => listTags(signal) });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
    void queryClient.invalidateQueries({ queryKey: ["tags"] });
  }

  const apply = useMutation<unknown, Error, string[]>({
    mutationFn: (tagIds) => setApplicationTags(applicationId, tagIds),
    onSuccess: invalidate,
  });

  /** 새 태그를 만들고 바로 이 지원에 붙인다 */
  const addNew = useMutation<Tag, Error, string>({
    mutationFn: async (name) => {
      const tag = await createTag({ name });
      await setApplicationTags(applicationId, [...selected, tag.id]);
      return tag;
    },
    onSuccess: () => {
      setAdding(false);
      invalidate();
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
    if (name) addNew.mutate(name);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">태그</h2>
        <Button variant="ghost" onClick={() => setAdding((open) => !open)} className="px-2 py-1 text-xs">
          {adding ? "닫기" : "+ 새 태그"}
        </Button>
      </div>

      {adding ? (
        <form onSubmit={onCreate} className="flex gap-2">
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
        </form>
      ) : null}

      {myTags.isPending ? (
        <Spinner />
      ) : myTags.isError ? (
        <ErrorText message={myTags.error.message} />
      ) : myTags.data.length === 0 ? (
        <p className="text-xs text-muted">아직 태그가 없습니다. &apos;+ 새 태그&apos;로 만들어 보세요.</p>
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
                className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                  on
                    ? "border-accent bg-accent-soft font-medium text-foreground"
                    : "border-border text-muted hover:border-accent"
                }`}
              >
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
