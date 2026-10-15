import { Injectable, NotFoundException } from '@nestjs/common';
import { ensureApplicationOwned } from '../common/ownership.js';
import {
  ApplicationStatus,
  InterviewResult,
  type InterviewType,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateApplicationDto,
  ListApplicationsQuery,
  MoveApplicationDto,
  UpdateApplicationDto,
} from './dto/application.dto.js';

/** 카드에 쓸 정보. 다가오는 면접은 가장 가까운 1건만 가져온다 (now가 매번 달라져서 함수) */
const listInclude = () =>
  ({
    tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
    _count: { select: { interviews: true, notes: true } },
    interviews: {
      where: { scheduledAt: { gte: new Date() }, result: InterviewResult.PENDING },
      orderBy: { scheduledAt: 'asc' },
      take: 1,
      select: { id: true, scheduledAt: true, type: true },
    },
  }) satisfies Prisma.ApplicationInclude;

type NextInterview = { id: string; scheduledAt: Date; type: InterviewType };

/** 목록·카드 응답: 면접 배열 대신 nextInterview 한 건으로 내려준다 */
function toCard<T extends { interviews: NextInterview[] }>(application: T) {
  const { interviews, ...rest } = application;
  return { ...rest, nextInterview: interviews[0] ?? null };
}

const detailInclude = {
  tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
  interviews: { orderBy: { scheduledAt: 'asc' } },
  notes: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.ApplicationInclude;

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 칸반 표시 순서: 상태(enum 순서) → 컬럼 내 순서 → 생성 시각 */
  list(userId: string, query: ListApplicationsQuery) {
    const where: Prisma.ApplicationWhereInput = { userId };
    if (query.status) where.status = query.status;
    if (query.tagId) where.tags = { some: { tagId: query.tagId } };
    if (query.q) {
      where.OR = [
        { companyName: { contains: query.q, mode: 'insensitive' } },
        { position: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.application
      .findMany({
        where,
        include: listInclude(),
        orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      .then((rows) => rows.map(toCard));
  }

  async get(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({
      where: { id, userId },
      include: detailInclude,
    });
    if (!app) throw new NotFoundException('지원 내역을 찾을 수 없습니다');
    return app;
  }

  /** 새 카드는 해당 컬럼의 맨 아래에 추가하고, 첫 상태를 이력에 남긴다 */
  create(userId: string, dto: CreateApplicationDto) {
    const status = dto.status ?? ApplicationStatus.INTERESTED;
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.application.aggregate({
        where: { userId, status },
        _max: { sortOrder: true },
      });
      const created = await tx.application.create({
        data: {
          userId,
          companyName: dto.companyName,
          position: dto.position,
          status,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
          jobUrl: dto.jobUrl ?? null,
          salaryNote: dto.salaryNote ?? null,
          appliedAt: dto.appliedAt ?? (status === ApplicationStatus.INTERESTED ? null : new Date()),
          statusHistory: { create: { fromStatus: null, toStatus: status } },
        },
        include: listInclude(),
      });
      return toCard(created);
    });
  }

  async update(userId: string, id: string, dto: UpdateApplicationDto) {
    await this.ensureOwned(userId, id);
    // 상태 변경은 move()로만 처리한다
    const { status: _ignored, ...data } = dto;
    const updated = await this.prisma.application.update({ where: { id }, data, include: listInclude() });
    return toCard(updated);
  }

  /**
   * 칸반 이동: 대상 컬럼의 index 위치에 끼워 넣고 컬럼 순서를 다시 매긴다.
   * 상태가 바뀌면 이력을 남기고, 처음 '지원' 이후 단계로 가면 지원일을 채운다.
   */
  async move(userId: string, id: string, dto: MoveApplicationDto) {
    return this.prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id, userId },
        select: { id: true, status: true, appliedAt: true },
      });
      if (!app) throw new NotFoundException('지원 내역을 찾을 수 없습니다');

      const column = await tx.application.findMany({
        where: { userId, status: dto.status, NOT: { id } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, sortOrder: true },
      });
      const index = Math.min(dto.index, column.length);
      const ordered = column.map((c) => c.id);
      ordered.splice(index, 0, id);

      // 순서가 실제로 바뀐 카드만 업데이트
      const current = new Map(column.map((c) => [c.id, c.sortOrder]));
      for (const [i, cardId] of ordered.entries()) {
        if (cardId !== id && current.get(cardId) === i) continue;
        await tx.application.update({ where: { id: cardId }, data: { sortOrder: i } });
      }

      if (app.status !== dto.status) {
        await tx.application.update({
          where: { id },
          data: {
            status: dto.status,
            appliedAt:
              app.appliedAt ?? (dto.status === ApplicationStatus.INTERESTED ? null : new Date()),
            statusHistory: { create: { fromStatus: app.status, toStatus: dto.status } },
          },
        });
      }

      const moved = await tx.application.findUniqueOrThrow({ where: { id }, include: listInclude() });
      return toCard(moved);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.application.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('지원 내역을 찾을 수 없습니다');
  }

  async timeline(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    return this.prisma.statusHistory.findMany({
      where: { applicationId: id },
      orderBy: { changedAt: 'asc' },
      select: { id: true, fromStatus: true, toStatus: true, changedAt: true },
    });
  }

  private ensureOwned(userId: string, id: string): Promise<void> {
    return ensureApplicationOwned(this.prisma, userId, id);
  }
}
