import { readJwtSecret } from './auth-config';

describe('readJwtSecret', () => {
  it('accepts a secret of at least 32 characters', () => {
    const jwtSecret = 'x'.repeat(32);
    expect(readJwtSecret(() => jwtSecret)).toBe(jwtSecret);
  });

  it.each([undefined, '', 'x'.repeat(31)])('refuses %j', (jwtSecret) => {
    expect(() => readJwtSecret(() => jwtSecret)).toThrow(
      'JWT_SECRET must be at least 32 characters',
    );
  });
});
