import { Injectable, NotFoundException } from '@nestjs/common';
import { ensureApplicationOwned } from '../common/ownership.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto.js';

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, applicationId: string) {
    await ensureApplicationOwned(this.prisma, userId, applicationId);
    return this.prisma.interview.findMany({
      where: { applicationId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async create(userId: string, applicationId: string, dto: CreateInterviewDto) {
    await ensureApplicationOwned(this.prisma, userId, applicationId);
    return this.prisma.interview.create({
      data: {
        applicationId,
        scheduledAt: dto.scheduledAt,
        type: dto.type,
        location: dto.location ?? null,
        result: dto.result,
        memo: dto.memo ?? null,
      },
    });
  }

  async update(userId: string, applicationId: string, id: string, dto: UpdateInterviewDto) {
    await this.ensureInterview(userId, applicationId, id);
    return this.prisma.interview.update({ where: { id }, data: dto });
  }

  async remove(userId: string, applicationId: string, id: string): Promise<void> {
    await this.ensureInterview(userId, applicationId, id);
    await this.prisma.interview.delete({ where: { id } });
  }

  /** 면접이 그 지원 내역의 것이고, 그 지원 내역이 내 것인지까지 확인 */
  private async ensureInterview(userId: string, applicationId: string, id: string): Promise<void> {
    await ensureApplicationOwned(this.prisma, userId, applicationId);
    const count = await this.prisma.interview.count({ where: { id, applicationId } });
    if (count === 0) throw new NotFoundException('면접 일정을 찾을 수 없습니다');
  }
}
