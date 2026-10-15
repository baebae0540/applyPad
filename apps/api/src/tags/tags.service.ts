import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ensureApplicationOwned } from '../common/ownership.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTagDto, SetApplicationTagsDto, UpdateTagDto } from './dto/tag.dto.js';

const DUPLICATE_KEY = 'P2002';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 내 태그 목록 (몇 개의 지원에 붙어 있는지 함께) */
  list(userId: string) {
    return this.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { applications: true } } },
    });
  }

  async create(userId: string, dto: CreateTagDto) {
    try {
      return await this.prisma.tag.create({
        data: { userId, name: dto.name, color: dto.color ?? null },
      });
    } catch (error) {
      throw this.toConflict(error, dto.name);
    }
  }

  async update(userId: string, id: string, dto: UpdateTagDto) {
    await this.ensureTag(userId, id);
    try {
      return await this.prisma.tag.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.toConflict(error, dto.name ?? '');
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.tag.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('태그를 찾을 수 없습니다');
  }

  /** 지원에 붙은 태그를 통째로 교체한다 (붙이기·떼기를 한 번에) */
  async setForApplication(userId: string, applicationId: string, dto: SetApplicationTagsDto) {
    await ensureApplicationOwned(this.prisma, userId, applicationId);
    const tagIds = [...new Set(dto.tagIds)];

    if (tagIds.length > 0) {
      const owned = await this.prisma.tag.count({ where: { id: { in: tagIds }, userId } });
      if (owned !== tagIds.length) throw new NotFoundException('태그를 찾을 수 없습니다');
    }

    await this.prisma.$transaction([
      this.prisma.applicationTag.deleteMany({ where: { applicationId } }),
      this.prisma.applicationTag.createMany({
        data: tagIds.map((tagId) => ({ applicationId, tagId })),
      }),
    ]);

    return this.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: { tags: { select: { tag: { select: { id: true, name: true, color: true } } } } },
    });
  }

  private async ensureTag(userId: string, id: string): Promise<void> {
    const count = await this.prisma.tag.count({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('태그를 찾을 수 없습니다');
  }

  /** 같은 사용자 안에서 태그 이름은 유일하다 (schema의 @@unique([userId, name])) */
  private toConflict(error: unknown, name: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === DUPLICATE_KEY) {
      return new ConflictException(`이미 '${name}' 태그가 있습니다`);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
