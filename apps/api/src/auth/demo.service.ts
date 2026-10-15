import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  InterviewResult,
  InterviewType,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEMO_EMAIL_DOMAIN, DEMO_EMAIL_PREFIX } from './demo.constants.js';

const DAY_MS = 86_400_000;

/** 지금을 기준으로 n일 떨어진 그 날 hour시 (음수면 과거) */
function at(days: number, hour = 10): Date {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date;
}

type DemoApplication = {
  companyName: string;
  position: string;
  status: ApplicationStatus;
  jobUrl?: string;
  salaryNote?: string;
  /** 상태 변경 이력 (타임라인). 마지막 항목이 현재 상태가 된다 */
  history: { status: ApplicationStatus; daysAgo: number }[];
  interviews?: {
    days: number;
    hour: number;
    type: InterviewType;
    location?: string;
    memo?: string;
    result?: InterviewResult;
  }[];
  notes?: string[];
  tags?: string[];
};

const TAGS = ['네카라쿠배', '스타트업', '원격근무'];

/** 모든 기능(칸반·타임라인·면접·메모·태그·대시보드)이 한눈에 보이도록 짠 샘플 */
const SAMPLE: DemoApplication[] = [
  {
    companyName: '토스',
    position: '백엔드 개발자',
    status: ApplicationStatus.INTERVIEW,
    jobUrl: 'https://toss.im/career',
    salaryNote: '희망 6,000 / 현재 협의',
    history: [
      { status: ApplicationStatus.INTERESTED, daysAgo: 14 },
      { status: ApplicationStatus.APPLIED, daysAgo: 12 },
      { status: ApplicationStatus.DOCUMENT_PASSED, daysAgo: 6 },
      { status: ApplicationStatus.INTERVIEW, daysAgo: 3 },
    ],
    interviews: [
      { days: 1, hour: 14, type: InterviewType.ONSITE, location: '강남역 10번 출구', memo: '1차 기술 면접, 코드 리뷰 위주' },
      { days: 8, hour: 10, type: InterviewType.VIDEO, location: 'Google Meet', memo: '2차 컬처핏' },
    ],
    notes: ['면접관 2명. 결제 도메인 경험을 많이 물어봄.', '포트폴리오 PDF 미리 보내기'],
    tags: ['네카라쿠배'],
  },
  {
    companyName: '카카오',
    position: '플랫폼 엔지니어',
    status: ApplicationStatus.DOCUMENT_PASSED,
    salaryNote: '희망 6,500',
    history: [
      { status: ApplicationStatus.INTERESTED, daysAgo: 10 },
      { status: ApplicationStatus.APPLIED, daysAgo: 9 },
      { status: ApplicationStatus.DOCUMENT_PASSED, daysAgo: 2 },
    ],
    interviews: [
      { days: 4, hour: 16, type: InterviewType.CODING_TEST, location: '온라인', memo: '2시간, 알고리즘' },
    ],
    notes: ['코딩테스트 통과하면 1주 내 연락 준다고 함.'],
    tags: ['네카라쿠배'],
  },
  {
    companyName: '라인',
    position: '서버 개발자',
    status: ApplicationStatus.FINAL,
    history: [
      { status: ApplicationStatus.INTERESTED, daysAgo: 21 },
      { status: ApplicationStatus.APPLIED, daysAgo: 18 },
      { status: ApplicationStatus.DOCUMENT_PASSED, daysAgo: 12 },
      { status: ApplicationStatus.INTERVIEW, daysAgo: 7 },
      { status: ApplicationStatus.FINAL, daysAgo: 1 },
    ],
    interviews: [
      { days: -5, hour: 15, type: InterviewType.PHONE, memo: '1차 통과', result: InterviewResult.PASSED },
      { days: 2, hour: 11, type: InterviewType.ONSITE, location: '분당 라인플러스' },
    ],
    tags: ['네카라쿠배', '원격근무'],
  },
  {
    companyName: '네이버',
    position: '서버 개발자',
    status: ApplicationStatus.APPLIED,
    jobUrl: 'https://recruit.navercorp.com',
    history: [
      { status: ApplicationStatus.INTERESTED, daysAgo: 8 },
      { status: ApplicationStatus.APPLIED, daysAgo: 5 },
    ],
    tags: ['네카라쿠배'],
  },
  {
    companyName: '당근',
    position: '백엔드 개발자',
    status: ApplicationStatus.INTERESTED,
    jobUrl: 'https://about.daangn.com/jobs',
    history: [{ status: ApplicationStatus.INTERESTED, daysAgo: 3 }],
    notes: ['공고 마감 전에 지원하기'],
    tags: ['스타트업', '원격근무'],
  },
  {
    companyName: '쿠팡',
    position: '백엔드 엔지니어',
    status: ApplicationStatus.INTERESTED,
    salaryNote: '희망 7,000',
    history: [{ status: ApplicationStatus.INTERESTED, daysAgo: 2 }],
    tags: ['네카라쿠배'],
  },
  {
    companyName: '우아한형제들',
    position: '백엔드 개발자',
    status: ApplicationStatus.OFFER,
    salaryNote: '6,200 제안',
    history: [
      { status: ApplicationStatus.INTERESTED, daysAgo: 30 },
      { status: ApplicationStatus.APPLIED, daysAgo: 28 },
      { status: ApplicationStatus.DOCUMENT_PASSED, daysAgo: 24 },
      { status: ApplicationStatus.INTERVIEW, daysAgo: 18 },
      { status: ApplicationStatus.FINAL, daysAgo: 10 },
      { status: ApplicationStatus.OFFER, daysAgo: 4 },
    ],
    notes: ['처우 협의 6,200. 회신 기한 확인하기.'],
  },
  {
    companyName: '무신사',
    position: '백엔드 개발자',
    status: ApplicationStatus.REJECTED,
    history: [
      { status: ApplicationStatus.INTERESTED, daysAgo: 26 },
      { status: ApplicationStatus.APPLIED, daysAgo: 25 },
      { status: ApplicationStatus.REJECTED, daysAgo: 15 },
    ],
  },
];

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 둘러보기용 임시 계정을 만든다.
   * 방문자마다 새 계정 + 샘플 데이터를 주기 때문에 서로의 보드를 건드리지 않는다.
   * 비밀번호가 없어서(passwordHash null) 이메일 로그인으로는 다시 들어올 수 없는 일회용 계정이다.
   */
  async createUser(): Promise<string> {
    const email = `${DEMO_EMAIL_PREFIX}${randomUUID().slice(0, 8)}@${DEMO_EMAIL_DOMAIN}`;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: '데모 사용자' },
        select: { id: true },
      });

      const tags = await Promise.all(
        TAGS.map((name) => tx.tag.create({ data: { userId: user.id, name }, select: { id: true, name: true } })),
      );
      const tagIdByName = new Map(tags.map((tag) => [tag.name, tag.id]));

      // 컬럼별 순서는 샘플에 등장한 차례대로
      const sortOrders = new Map<ApplicationStatus, number>();

      for (const sample of SAMPLE) {
        const sortOrder = sortOrders.get(sample.status) ?? 0;
        sortOrders.set(sample.status, sortOrder + 1);

        const appliedAt = sample.history.find((h) => h.status === ApplicationStatus.APPLIED);

        await tx.application.create({
          data: {
            userId: user.id,
            companyName: sample.companyName,
            position: sample.position,
            status: sample.status,
            sortOrder,
            jobUrl: sample.jobUrl ?? null,
            salaryNote: sample.salaryNote ?? null,
            appliedAt: appliedAt ? at(-appliedAt.daysAgo) : null,
            createdAt: at(-(sample.history[0]?.daysAgo ?? 0)),
            statusHistory: {
              create: sample.history.map((entry, index) => ({
                fromStatus: index === 0 ? null : sample.history[index - 1].status,
                toStatus: entry.status,
                changedAt: at(-entry.daysAgo),
              })),
            },
            interviews: {
              create: (sample.interviews ?? []).map((interview) => ({
                scheduledAt: at(interview.days, interview.hour),
                type: interview.type,
                location: interview.location ?? null,
                memo: interview.memo ?? null,
                result: interview.result ?? InterviewResult.PENDING,
              })),
            },
            notes: {
              create: (sample.notes ?? []).map((content, index) => ({
                content,
                createdAt: at(-index - 1, 21),
              })),
            },
            tags: {
              create: (sample.tags ?? [])
                .map((name) => tagIdByName.get(name))
                .filter((tagId): tagId is string => Boolean(tagId))
                .map((tagId) => ({ tagId })),
            },
          },
        });
      }

      return user.id;
    });
  }
}
