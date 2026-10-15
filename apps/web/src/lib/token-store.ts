/**
 * access 토큰 보관소. 브라우저 **메모리에만** 둔다 (localStorage·쿠키 금지 → XSS로 토큰이 새지 않게).
 * 새로고침하면 사라지므로, 첫 로딩 때 refresh 쿠키로 세션을 복원한다 (lib/auth-context.tsx).
 *
 * React 밖(api.ts의 401 재시도)에서도 읽고 써야 해서 모듈 변수 + 구독 방식으로 둔다.
 * 서버에서는 요청 간에 공유되므로 클라이언트 컴포넌트에서만 import 한다.
 */

let accessToken: string | null = null;
const listeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  if (token === accessToken) return;
  accessToken = token;
  for (const listener of listeners) listener();
}

/** 토큰이 바뀔 때(발급·회전·폐기) 알림을 받는다. 반환값을 호출하면 구독 해제 */
export function subscribeAccessToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
