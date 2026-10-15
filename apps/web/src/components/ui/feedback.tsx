/** 로딩·에러 표시를 한 군데서 쓰기 위한 작은 조각들 */

export function Spinner({ label = "불러오는 중" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
      {label}
    </span>
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <Spinner label={label} />
    </div>
  );
}

/** 여러 줄 메시지(class-validator 오류)를 그대로 보여준다 */
export function ErrorText({ message }: { message: string }) {
  return (
    <p role="alert" className="whitespace-pre-line text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      <span className="whitespace-pre-line">{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="ml-auto font-medium underline">
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
