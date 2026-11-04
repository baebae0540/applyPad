/**
 * 태그 색 프리셋.
 *
 * API는 아무 #RRGGBB나 받지만, 화면에서는 고른 8색만 제안한다.
 * 색은 칩 배경이 아니라 이름 앞의 **작은 점**에만 쓴다. 칩 자체는 중립색이라
 * 라이트/다크 어느 쪽에서도 글자 대비가 유지되고, 색 이름 대신 태그 이름이 항상 함께 보인다.
 * 값은 밝은 표면(#fff)과 어두운 표면(#1b1b19) 양쪽에서 점이 보이도록 중간 명도로 골랐다.
 */
export const TAG_COLORS = [
  { value: "#78716c", label: "회색" },
  { value: "#ef4444", label: "빨강" },
  { value: "#f97316", label: "주황" },
  { value: "#eab308", label: "노랑" },
  { value: "#10b981", label: "초록" },
  { value: "#0ea5e9", label: "하늘" },
  { value: "#8b5cf6", label: "보라" },
  { value: "#ec4899", label: "분홍" },
] as const;

/** 대소문자만 다른 값도 같은 프리셋으로 본다 */
export function sameColor(a: string | null, b: string | null): boolean {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}
