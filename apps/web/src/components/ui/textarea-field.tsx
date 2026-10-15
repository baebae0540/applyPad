import { useId, type ComponentProps } from "react";
import { INPUT_CLASS } from "./text-field";

export function TextareaField({
  label,
  id,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { label: string }) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textareaId} className="text-sm font-medium">
        {label}
      </label>
      <textarea id={textareaId} rows={3} {...props} className={`${INPUT_CLASS} resize-y ${className}`} />
    </div>
  );
}
