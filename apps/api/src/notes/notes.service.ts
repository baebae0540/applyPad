import { Injectable, NotFoundException } from '@nestjs/common';
import { ensureApplicationOwned } from '../common/ownership.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateNoteDto, UpdateNoteDto } from './dto/note.dto.js';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 최근 메모가 위로 */
  async list(userId: string, applicationId: string) {
    await ensureApplicationOwned(this.prisma, userId, applicationId);
    return this.prisma.note.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: string, applicationId: string, dto: CreateNoteDto) {
    await ensureApplicationOwned(this.prisma, userId, applicationId);
    return this.prisma.note.create({ data: { applicationId, content: dto.content } });
  }

  async update(userId: string, applicationId: string, id: string, dto: UpdateNoteDto) {
    await this.ensureNote(userId, applicationId, id);
    return this.prisma.note.update({ where: { id }, data: dto });
  }

  async remove(userId: string, applicationId: string, id: string): Promise<void> {
    await this.ensureNote(userId, applicationId, id);
    await this.prisma.note.delete({ where: { id } });
  }

  private async ensureNote(userId: string, applicationId: string, id: string): Promise<void> {
    await ensureApplicationOwned(this.prisma, userId, applicationId);
    const count = await this.prisma.note.count({ where: { id, applicationId } });
    if (count === 0) throw new NotFoundException('메모를 찾을 수 없습니다');
  }
}
