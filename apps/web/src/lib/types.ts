/**
 * API 응답·요청 타입. apps/api의 DTO와 Prisma 모델에 맞춘다.
 * JSON으로 오가므로 DateTime은 모두 ISO 문자열이다.
 */

/** 칸반 컬럼 순서 = Prisma enum 선언 순서 (API의 정렬 기준과 같다) */
export const APPLICATION_STATUSES = [
  "INTERESTED",
  "APPLIED",
  "DOCUMENT_PASSED",
  "INTERVIEW",
  "FINAL",
  "OFFER",
  "REJECTED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type InterviewType = "PHONE" | "VIDEO" | "ONSITE" | "CODING_TEST" | "OTHER";
export type InterviewResult = "PENDING" | "PASSED" | "FAILED";

// ---------- 인증 ----------

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  providers: string[];
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};

export type LoginInput = { email: string; password: string };
export type SignupInput = { email: string; password: string; name?: string };

// ---------- 지원 카드 ----------

export type Tag = { id: string; name: string; color: string | null };

/** 카드에 표시할 다가오는 면접 (목록 응답에 1건만 담겨 온다) */
export type NextInterview = { id: string; scheduledAt: string; type: InterviewType };

/** 목록(GET /applications)에 담겨 오는 카드 */
export type Application = {
  id: string;
  userId: string;
  companyName: string;
  position: string;
  status: ApplicationStatus;
  sortOrder: number;
  jobUrl: string | null;
  appliedAt: string | null;
  salaryNote: string | null;
  createdAt: string;
  updatedAt: string;
  tags: { tag: Tag }[];
  _count: { interviews: number; notes: number };
  nextInterview: NextInterview | null;
};

export type Interview = {
  id: string;
  applicationId: string;
  scheduledAt: string;
  type: InterviewType;
  location: string | null;
  result: InterviewResult;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Note = {
  id: string;
  applicationId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

/** 상세(GET /applications/:id)는 면접·메모 전체를 준다 (_count, nextInterview 없음) */
export type ApplicationDetail = Omit<Application, "_count" | "nextInterview"> & {
  interviews: Interview[];
  notes: Note[];
};

export type StatusHistoryEntry = {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt: string;
};

export type CreateApplicationInput = {
  companyName: string;
  position: string;
  status?: ApplicationStatus;
  jobUrl?: string | null;
  appliedAt?: string | null;
  salaryNote?: string | null;
};

/** 상태·순서는 move로만 바꾼다 (API가 PATCH /:id의 status를 무시한다) */
export type UpdateApplicationInput = Omit<CreateApplicationInput, "status">;

export type MoveApplicationInput = { status: ApplicationStatus; index: number };

export type ListApplicationsQuery = { status?: ApplicationStatus; q?: string; tagId?: string };

export type HealthResponse = {
  status: "ok" | "error";
  db: "up" | "down";
  time?: string;
};

// ---------- 면접 · 메모 · 태그 (5단계) ----------

export type CreateInterviewInput = {
  scheduledAt: string;
  type?: InterviewType;
  location?: string | null;
  result?: InterviewResult;
  memo?: string | null;
};
export type UpdateInterviewInput = Partial<CreateInterviewInput>;

export type NoteInput = { content: string };

export type TagWithCount = Tag & { _count: { applications: number } };
export type CreateTagInput = { name: string; color?: string | null };
export type UpdateTagInput = Partial<CreateTagInput>;

// ---------- 대시보드 ----------

export type UpcomingInterview = Interview & {
  application: { id: string; companyName: string; position: string; status: ApplicationStatus };
};

export type Dashboard = {
  total: number;
  statusCounts: Record<ApplicationStatus, number>;
  upcomingInterviews: UpcomingInterview[];
};
