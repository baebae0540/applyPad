/**
 * 상태·면접 enum의 한글 라벨과 색.
 *
 * 색은 임의의 7색 팔레트가 아니라 데이터 성격에 맞춘다.
 * - 관심 → 최종: 한 방향으로 나아가는 **진행 단계**라서 파랑 한 가지 색의 순차 램프 (밝음 → 어두움)
 * - 합격 / 불합격: 단계가 아니라 **결과**라서 상태색(초록/빨강)을 따로 쓴다
 * 다크 모드는 자동 반전이 아니라 램프 방향을 뒤집어 어두운 표면에서도 단조롭게 밝아지도록 고른 값이다.
 * 가장 밝은 단계는 표면 대비가 3:1 미만이라, 막대·점 옆에 항상 이름과 숫자를 함께 보여준다.
 */
import type { ApplicationStatus, InterviewResult, InterviewType } from "./types";

export const STATUS_META: Record<ApplicationStatus, { label: string; dot: string; chip: string }> = {
  INTERESTED: {
    label: "관심",
    dot: "bg-blue-300 dark:bg-blue-800",
    chip: "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  },
  APPLIED: {
    label: "지원",
    dot: "bg-blue-400 dark:bg-blue-700",
    chip: "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
  },
  DOCUMENT_PASSED: {
    label: "서류 통과",
    dot: "bg-blue-500 dark:bg-blue-600",
    chip: "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-50",
  },
  INTERVIEW: {
    label: "면접",
    dot: "bg-blue-600 dark:bg-blue-500",
    chip: "bg-blue-300 text-blue-950 dark:bg-blue-700 dark:text-blue-50",
  },
  FINAL: {
    label: "최종",
    dot: "bg-blue-700 dark:bg-blue-400",
    chip: "bg-blue-400 text-white dark:bg-blue-600 dark:text-blue-50",
  },
  OFFER: {
    label: "합격",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  REJECTED: {
    label: "불합격",
    dot: "bg-red-500",
    chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  },
};

/** 진행 중으로 보는 단계 (대시보드 요약용) */
export const IN_PROGRESS_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "DOCUMENT_PASSED",
  "INTERVIEW",
  "FINAL",
];

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  PHONE: "전화",
  VIDEO: "화상",
  ONSITE: "대면",
  CODING_TEST: "코딩 테스트",
  OTHER: "기타",
};

export const INTERVIEW_RESULT_META: Record<InterviewResult, { label: string; chip: string }> = {
  PENDING: { label: "예정", chip: "bg-accent-soft text-foreground" },
  PASSED: { label: "통과", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  FAILED: { label: "탈락", chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
};
