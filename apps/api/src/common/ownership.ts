import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * 이 지원 내역이 해당 사용자의 것인지 확인한다.
 * 남의 데이터는 존재 여부도 알리지 않도록 403이 아니라 404로 응답한다.
 */
export async function ensureApplicationOwned(
  prisma: PrismaService,
  userId: string,
  applicationId: string,
): Promise<void> {
  const count = await prisma.application.count({ where: { id: applicationId, userId } });
  if (count === 0) throw new NotFoundException('지원 내역을 찾을 수 없습니다');
}
