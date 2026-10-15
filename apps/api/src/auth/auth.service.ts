import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, SignupDto, UserDto } from './dto/auth.dto.js';
import type { GoogleProfile } from './google-oauth.service.js';
import { getDummyHash, hashPassword, verifyPassword } from './password.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  passwordHash: true,
  accounts: { select: { provider: true } },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export function toUserDto(user: SelectedUser): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    hasPassword: user.passwordHash !== null,
    providers: user.accounts.map((a) => a.provider),
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(dto: SignupDto): Promise<UserDto> {
    const passwordHash = await hashPassword(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name?.trim() || null, passwordHash },
        select: userSelect,
      });
      return toUserDto(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('이미 가입된 이메일입니다');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: userSelect,
    });
    // 계정이 없거나 소셜 전용 계정이어도 같은 시간, 같은 메시지로 응답한다
    const ok = await verifyPassword(dto.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !user.passwordHash || !ok) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }
    return toUserDto(user);
  }

  async getUser(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    return toUserDto(user);
  }

  /**
   * Google 프로필로 로그인한다.
   * 1) 이미 연결된 Google 계정이 있으면 그 사용자
   * 2) 같은 이메일의 사용자가 있으면 Google 계정을 연결 (Google이 이메일을 인증한 경우만)
   * 3) 없으면 새로 가입
   */
  async loginWithGoogle(profile: GoogleProfile): Promise<UserDto> {
    if (!profile.emailVerified) {
      throw new UnauthorizedException('Google 계정의 이메일 인증이 필요합니다');
    }
    const email = profile.email.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.account.findUnique({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.sub } },
        select: { user: { select: userSelect } },
      });
      if (linked) return toUserDto(linked.user);

      const existing = await tx.user.findUnique({ where: { email }, select: { id: true, name: true, avatarUrl: true } });
      if (existing) {
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name ?? profile.name ?? null,
            avatarUrl: existing.avatarUrl ?? profile.picture ?? null,
            accounts: { create: { provider: 'google', providerAccountId: profile.sub } },
          },
          select: userSelect,
        });
        return toUserDto(user);
      }

      const user = await tx.user.create({
        data: {
          email,
          name: profile.name ?? null,
          avatarUrl: profile.picture ?? null,
          accounts: { create: { provider: 'google', providerAccountId: profile.sub } },
        },
        select: userSelect,
      });
      return toUserDto(user);
    });
  }
}
