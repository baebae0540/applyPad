import { hashPassword, verifyPassword } from './password.js';
import { sanitizeRedirect } from './google-oauth.service.js';
import { durationToMs } from '../config/env.js';

describe('password', () => {
  it('해시는 매번 달라도(솔트) 원래 비밀번호로 검증된다', async () => {
    const a = await hashPassword('password-1234');
    const b = await hashPassword('password-1234');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('password-1234', a)).toBe(true);
    expect(await verifyPassword('password-12345', a)).toBe(false);
  });

  it('형식이 깨진 해시는 false', async () => {
    expect(await verifyPassword('x', 'bcrypt$whatever')).toBe(false);
  });
});

describe('sanitizeRedirect', () => {
  it.each([
    ['/board', '/board'],
    ['/applications/1?tab=notes', '/applications/1?tab=notes'],
    ['//evil.com', '/board'],
    ['https://evil.com', '/board'],
    ['/\\evil.com', '/board'],
    [undefined, '/board'],
  ])('%s → %s', (input, expected) => {
    expect(sanitizeRedirect(input)).toBe(expected);
  });
});

describe('durationToMs', () => {
  it('s/m/h/d 단위를 변환한다', () => {
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('14d')).toBe(14 * 86_400_000);
    expect(() => durationToMs('15')).toThrow();
  });
});
