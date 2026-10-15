/** refresh 토큰 쿠키. /api/auth 경로에만 전송되도록 범위를 좁힌다 */
export const REFRESH_COOKIE = 'applypad_rt';
export const REFRESH_COOKIE_PATH = '/api/auth';

/** Google OAuth 진행 중 state, PKCE verifier를 담는 임시 쿠키 */
export const OAUTH_COOKIE = 'applypad_oauth';
export const OAUTH_COOKIE_PATH = '/api/auth/google';
export const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

/** 동시 요청(탭 여러 개)으로 같은 refresh 토큰이 두 번 쓰이는 경우를 탈취로 오인하지 않기 위한 유예 시간 */
export const REFRESH_REUSE_GRACE_MS = 10 * 1000;

export const IS_PUBLIC_KEY = 'isPublic';
