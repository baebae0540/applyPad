import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a',
  };

  it('필수 값이 있으면 기본값을 채워 반환한다', () => {
    const env = validateEnv({ ...base });
    expect(env.API_PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
  });

  it('문자열 포트를 숫자로 변환한다', () => {
    expect(validateEnv({ ...base, API_PORT: '5000' }).API_PORT).toBe(5000);
  });

  it('DATABASE_URL이 없으면 실패한다', () => {
    const { DATABASE_URL: _omit, ...rest } = base;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['false', false],
    ['0', false],
    ['true', true],
    ['1', true],
    [undefined, false],
  ])('COOKIE_SECURE=%s → %s', (raw, expected) => {
    expect(validateEnv({ ...base, COOKIE_SECURE: raw }).COOKIE_SECURE).toBe(expected);
  });
});
