"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createNote, deleteNote, updateNote } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { text } from "@/lib/form";
import type { Note } from "@/lib/types";
import { Button } from "../ui/button";
import { ErrorText } from "../ui/feedback";
import { TextareaField } from "../ui/textarea-field";

export function NotesSection({ applicationId, notes }: { applicationId: string; notes: Note[] }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
  }

  const add = useMutation<Note, Error, string>({
    mutationFn: (content) => createNote(applicationId, { content }),
    onSuccess: invalidate,
  });

  const edit = useMutation<Note, Error, { id: string; content: string }>({
    mutationFn: ({ id, content }) => updateNote(applicationId, id, { content }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (id) => deleteNote(applicationId, id),
    onSuccess: invalidate,
  });

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = text(new FormData(form).get("content"));
    if (!content) return;
    add.mutate(content, { onSuccess: () => form.reset() });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">메모</h2>

      <form onSubmit={onAdd} className="flex flex-col gap-2">
        <TextareaField
          label="새 메모"
          name="content"
          placeholder="면접 분위기, 챙길 것, 질문 목록…"
          maxLength={5000}
          required
        />
        {add.isError ? <ErrorText message={add.error.message} /> : null}
        <Button type="submit" disabled={add.isPending} className="self-end px-3 py-1.5 text-xs">
          {add.isPending ? "추가 중…" : "추가"}
        </Button>
      </form>

      {notes.length === 0 ? (
        <p className="text-xs text-muted">아직 메모가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) =>
            editingId === note.id ? (
              <li key={note.id}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const content = text(new FormData(event.currentTarget).get("content"));
                    if (content) edit.mutate({ id: note.id, content });
                  }}
                  className="flex flex-col gap-2"
                >
                  <TextareaField label="메모 수정" name="content" defaultValue={note.content} maxLength={5000} required />
                  {edit.isError ? <ErrorText message={edit.error.message} /> : null}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs"
                    >
                      취소
                    </Button>
                    <Button type="submit" disabled={edit.isPending} className="px-3 py-1.5 text-xs">
                      저장
                    </Button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={note.id} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                <p className="whitespace-pre-line text-sm">{note.content}</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted">{formatDateTime(note.createdAt)}</span>
                  <Button
                    variant="ghost"
                    onClick={() => setEditingId(note.id)}
                    className="ml-auto px-2 py-1 text-xs"
                  >
                    수정
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => remove.mutate(note.id)}
                    disabled={remove.isPending}
                    className="px-2 py-1 text-xs"
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {remove.isError ? <ErrorText message={remove.error.message} /> : null}
    </section>
  );
}
