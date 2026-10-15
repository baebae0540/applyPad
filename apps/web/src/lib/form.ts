/** 폼 입력값 정리. API는 빈 문자열 대신 null을 기대하는 선택 필드가 많다 */

export function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function textOrNull(value: FormDataEntryValue | null): string | null {
  const trimmed = text(value);
  return trimmed === "" ? null : trimmed;
}
