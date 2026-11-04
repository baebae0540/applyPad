/** 태그 이름 앞에 붙는 색 점. 색이 없으면 아무것도 그리지 않는다 */
export function TagDot({ color, className = "size-2" }: { color: string | null; className?: string }) {
  if (!color) return null;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
