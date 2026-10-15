/** 날짜 표시용 포맷터. API는 ISO 문자열을 주고, 화면에는 사용자 로컬 시간대로 보여준다 */

const DATE = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const MONTH_DAY = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });

/** 카드처럼 좁은 자리에 쓰는 '10월 21일' */
export function formatMonthDay(iso: string | null | undefined): string {
  if (!iso) return "-";
  return MONTH_DAY.format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return DATE.format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return DATE_TIME.format(new Date(iso));
}

/** <input type="date">의 value 형식(YYYY-MM-DD, 로컬 기준) */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** <input type="date">에서 받은 값을 API가 받는 ISO 문자열로 (빈 값은 null) */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** <input type="datetime-local">의 value 형식(YYYY-MM-DDTHH:mm, 로컬 기준) */
export function toDateTimeInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local">에서 받은 값을 ISO 문자열로 (빈 값은 null) */
export function fromDateTimeInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
