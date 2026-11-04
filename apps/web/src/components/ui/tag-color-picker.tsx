"use client";

import { useId } from "react";
import { sameColor, TAG_COLORS } from "@/lib/tag-colors";

const OPTIONS: { value: string | null; label: string }[] = [{ value: null, label: "없음" }, ...TAG_COLORS];

/**
 * 태그 색 고르기 (라디오 그룹, 제어 컴포넌트). "없음"을 포함한 9개 중 하나.
 * 라디오 name은 인스턴스마다 고유해야 한다. 폼 밖의 라디오는 같은 name이면 페이지 전체가 한 그룹으로 묶인다.
 */
export function TagColorPicker({
  value,
  onChange,
  disabled,
  label = "태그 색",
}: {
  value: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const groupName = `tag-color-${useId()}`;

  return (
    <fieldset disabled={disabled} className="flex flex-wrap items-center gap-1.5 disabled:opacity-50">
      <legend className="sr-only">{label}</legend>
      {OPTIONS.map((option) => (
        <label key={option.label} title={option.label} className="cursor-pointer">
          <input
            type="radio"
            name={groupName}
            checked={sameColor(value, option.value)}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span className="sr-only">{option.label}</span>
          <span
            aria-hidden
            className="block size-5 rounded-full border border-border ring-offset-2 ring-offset-surface transition peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent"
            style={option.value ? { backgroundColor: option.value, borderColor: "transparent" } : undefined}
          >
            {option.value ? null : (
              // 없음: 사선으로 표시
              <svg viewBox="0 0 20 20" className="size-full text-muted">
                <line x1="5" y1="15" x2="15" y2="5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
