import { useId, type ComponentProps } from "react";

export const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent";

export function TextField({
  label,
  hint,
  id,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input id={inputId} {...props} className={`${INPUT_CLASS} ${className}`} />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
