import { useId, type ComponentProps } from "react";
import { INPUT_CLASS } from "./text-field";

export function SelectField({
  label,
  id,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { label: string }) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium">
        {label}
      </label>
      <select id={selectId} {...props} className={`${INPUT_CLASS} ${className}`}>
        {children}
      </select>
    </div>
  );
}
