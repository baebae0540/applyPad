/**
 * API 클라이언트. 브라우저는 항상 같은 출처의 /api 로 호출하고,
 * next.config.ts의 rewrites가 API 서버로 프록시한다 (refresh 쿠키가 1st-party 쿠키로 동작).
 */
import { getAccessToken, setAccessToken } from "./token-store";
import type {
  Application,
  ApplicationDetail,
  AuthResponse,
  CreateApplicationInput,
  CreateInterviewInput,
  CreateTagInput,
  Dashboard,
  HealthResponse,
  Interview,
  ListApplicationsQuery,
  LoginInput,
  MoveApplicationInput,
  Note,
  NoteInput,
  SignupInput,
  StatusHistoryEntry,
  Tag,
  TagWithCount,
  UpdateApplicationInput,
  UpdateInterviewInput,
  UpdateTagInput,
  User,
} from "./types";

export const API_BASE = "/api";

/** 서버가 준 상태 코드와 메시지를 그대로 들고 다니는 에러 (화면에서 메시지를 보여준다) */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** false면 Authorization 헤더를 붙이지 않고, 401이어도 refresh 재시도를 하지 않는다 */
  auth?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = auth ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    signal,
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) throw await toApiError(res);
  // 204 No Content (logout, delete)
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `요청에 실패했습니다 (${res.status})`;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    // class-validator는 message를 배열로 준다
    if (Array.isArray(body.message) && body.message.length > 0) message = body.message.join("\n");
    else if (typeof body.message === "string" && body.message.length > 0) message = body.message;
  } catch {
    // 본문이 비었거나 JSON이 아니면 기본 메시지를 쓴다
  }
  return new ApiError(res.status, message);
}

/** 진행 중인 refresh. 여러 요청이 동시에 401을 받아도 refresh는 한 번만 실행한다 */
let inFlightRefresh: Promise<AuthResponse> | null = null;

/** refresh 쿠키로 access 토큰을 재발급한다 (refresh 토큰도 함께 회전) */
export function refreshSession(): Promise<AuthResponse> {
  inFlightRefresh ??= request<AuthResponse>("/auth/refresh", { method: "POST", auth: false })
    .then((res) => {
      setAccessToken(res.accessToken);
      return res;
    })
    .catch((error: unknown) => {
      setAccessToken(null);
      throw error;
    })
    .finally(() => {
      inFlightRefresh = null;
    });
  return inFlightRefresh;
}

/** 인증이 필요한 호출. 401이면 refresh를 한 번 시도하고 같은 요청을 다시 보낸다 */
async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    const expired = error instanceof ApiError && error.status === 401 && options.auth !== false;
    if (!expired) throw error;
    // refresh까지 실패하면 그 에러를 그대로 올린다 (AuthProvider가 비로그인으로 전환)
    await refreshSession();
    return await request<T>(path, options);
  }
}

// ---------- 인증 ----------

export async function signup(input: SignupInput): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/auth/signup", { method: "POST", body: input, auth: false });
  setAccessToken(res.accessToken);
  return res;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/auth/login", { method: "POST", body: input, auth: false });
  setAccessToken(res.accessToken);
  return res;
}

/** 둘러보기: 샘플 데이터가 담긴 임시 계정을 받아 바로 로그인한다 */
export async function startDemo(): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/auth/demo", { method: "POST", auth: false });
  setAccessToken(res.accessToken);
  return res;
}

export async function logout(): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST", auth: false });
  } finally {
    setAccessToken(null);
  }
}

export function fetchMe(signal?: AbortSignal): Promise<User> {
  return apiFetch<User>("/auth/me", { signal });
}

/** Google 로그인 시작 주소. 서버가 302로 이동시키므로 location.href로 **전체 이동**해야 한다 */
export function googleLoginUrl(redirect = "/board"): string {
  return `${API_BASE}/auth/google?redirect=${encodeURIComponent(redirect)}`;
}

// ---------- 지원 카드 ----------

export function listApplications(
  query: ListApplicationsQuery = {},
  signal?: AbortSignal,
): Promise<Application[]> {
  const search = new URLSearchParams();
  if (query.status) search.set("status", query.status);
  if (query.q) search.set("q", query.q);
  if (query.tagId) search.set("tagId", query.tagId);
  const qs = search.toString();
  return apiFetch<Application[]>(`/applications${qs ? `?${qs}` : ""}`, { signal });
}

export function getApplication(id: string, signal?: AbortSignal): Promise<ApplicationDetail> {
  return apiFetch<ApplicationDetail>(`/applications/${id}`, { signal });
}

export function createApplication(input: CreateApplicationInput): Promise<Application> {
  return apiFetch<Application>("/applications", { method: "POST", body: input });
}

export function updateApplication(id: string, input: UpdateApplicationInput): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}`, { method: "PATCH", body: input });
}

/** 칸반 이동. 상태가 바뀌면 서버가 타임라인과 지원일을 자동으로 채운다 */
export function moveApplication(id: string, input: MoveApplicationInput): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}/move`, { method: "PATCH", body: input });
}

export function deleteApplication(id: string): Promise<void> {
  return apiFetch<void>(`/applications/${id}`, { method: "DELETE" });
}

export function getTimeline(id: string, signal?: AbortSignal): Promise<StatusHistoryEntry[]> {
  return apiFetch<StatusHistoryEntry[]>(`/applications/${id}/timeline`, { signal });
}

// ---------- 면접 ----------

export function listInterviews(applicationId: string, signal?: AbortSignal): Promise<Interview[]> {
  return apiFetch<Interview[]>(`/applications/${applicationId}/interviews`, { signal });
}

export function createInterview(applicationId: string, input: CreateInterviewInput): Promise<Interview> {
  return apiFetch<Interview>(`/applications/${applicationId}/interviews`, { method: "POST", body: input });
}

export function updateInterview(
  applicationId: string,
  id: string,
  input: UpdateInterviewInput,
): Promise<Interview> {
  return apiFetch<Interview>(`/applications/${applicationId}/interviews/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteInterview(applicationId: string, id: string): Promise<void> {
  return apiFetch<void>(`/applications/${applicationId}/interviews/${id}`, { method: "DELETE" });
}

// ---------- 메모 ----------

export function listNotes(applicationId: string, signal?: AbortSignal): Promise<Note[]> {
  return apiFetch<Note[]>(`/applications/${applicationId}/notes`, { signal });
}

export function createNote(applicationId: string, input: NoteInput): Promise<Note> {
  return apiFetch<Note>(`/applications/${applicationId}/notes`, { method: "POST", body: input });
}

export function updateNote(applicationId: string, id: string, input: NoteInput): Promise<Note> {
  return apiFetch<Note>(`/applications/${applicationId}/notes/${id}`, { method: "PATCH", body: input });
}

export function deleteNote(applicationId: string, id: string): Promise<void> {
  return apiFetch<void>(`/applications/${applicationId}/notes/${id}`, { method: "DELETE" });
}

// ---------- 태그 ----------

export function listTags(signal?: AbortSignal): Promise<TagWithCount[]> {
  return apiFetch<TagWithCount[]>("/tags", { signal });
}

export function createTag(input: CreateTagInput): Promise<Tag> {
  return apiFetch<Tag>("/tags", { method: "POST", body: input });
}

export function updateTag(id: string, input: UpdateTagInput): Promise<Tag> {
  return apiFetch<Tag>(`/tags/${id}`, { method: "PATCH", body: input });
}

export function deleteTag(id: string): Promise<void> {
  return apiFetch<void>(`/tags/${id}`, { method: "DELETE" });
}

/** 지원에 붙은 태그를 통째로 교체한다 */
export function setApplicationTags(
  applicationId: string,
  tagIds: string[],
): Promise<{ tags: { tag: Tag }[] }> {
  return apiFetch<{ tags: { tag: Tag }[] }>(`/applications/${applicationId}/tags`, {
    method: "PUT",
    body: { tagIds },
  });
}

// ---------- 대시보드 ----------

export function getDashboard(signal?: AbortSignal): Promise<Dashboard> {
  return apiFetch<Dashboard>("/dashboard", { signal });
}

// ---------- 헬스체크 ----------

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  try {
    return await request<HealthResponse>("/health", { signal, auth: false });
  } catch (error) {
    if (error instanceof ApiError) return { status: "error", db: "down" };
    throw error;
  }
}
