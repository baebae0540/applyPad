/** DTO에서 공통으로 쓰는 입력 정리 (class-transformer @Transform에 넣는다) */

export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** 선택 입력의 빈 문자열은 '지움'으로 보고 null로 저장한다 */
export const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/** 앞뒤 공백을 없애고, 남는 게 없으면 null (선택 입력용) */
export const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
