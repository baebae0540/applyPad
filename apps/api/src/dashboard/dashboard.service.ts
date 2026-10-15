import { Injectable } from '@nestjs/common';
import { ApplicationStatus, InterviewResult } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 대시보드에 보여줄 다가오는 면접 개수 */
const UPCOMING_LIMIT = 10;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const now = new Date();

    const [grouped, upcomingInterviews, total] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.interview.findMany({
        where: {
          application: { userId },
          scheduledAt: { gte: now },
          result: InterviewResult.PENDING,
        },
        orderBy: { scheduledAt: 'asc' },
        take: UPCOMING_LIMIT,
        include: {
          application: { select: { id: true, companyName: true, position: true, status: true } },
        },
      }),
      this.prisma.application.count({ where: { userId } }),
    ]);

    // 비어 있는 상태도 0으로 채워서 화면이 컬럼 구성을 그대로 그릴 수 있게 한다
    const statusCounts = Object.fromEntries(
      Object.values(ApplicationStatus).map((status) => [status, 0]),
    ) as Record<ApplicationStatus, number>;
    for (const row of grouped) statusCounts[row.status] = row._count._all;

    return { total, statusCounts, upcomingInterviews };
  }
}
