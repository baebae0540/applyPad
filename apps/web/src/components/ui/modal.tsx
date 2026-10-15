"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 네이티브 <dialog>로 만든 모달. Esc 닫기와 포커스 가두기를 브라우저가 해준다.
 * 백드롭(요소 바깥) 클릭도 닫기로 처리한다.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-4rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-foreground shadow-xl backdrop:bg-black/40"
    >
      {open ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="-m-1 rounded-md p-1 text-muted transition hover:bg-accent-soft hover:text-foreground"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
