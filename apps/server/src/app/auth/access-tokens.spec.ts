import { JwtService } from '@nestjs/jwt';
import { TEST_JWT_SECRET } from '../../testing/test-secrets';
import { FixedClock } from '../common/clock';
import { AccessTokens } from './access-tokens';
import { ACCESS_TOKEN_LIFETIME_MS } from './session';

const ADMIN_ID = '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83';
const SIGN_IN_TIME = new Date('2026-11-02T09:00:00Z');

describe('AccessTokens', () => {
  function accessTokensAt(
    clock: FixedClock,
    secret = TEST_JWT_SECRET,
  ): AccessTokens {
    return new AccessTokens(new JwtService({ secret }), clock);
  }

  it('identifies the admin a token was issued to', () => {
    const accessTokens = accessTokensAt(new FixedClock(SIGN_IN_TIME));

    expect(accessTokens.adminIdFrom(accessTokens.issue(ADMIN_ID))).toBe(
      ADMIN_ID,
    );
  });

  it('stops accepting a token once its fifteen minutes are up', () => {
    const clock = new FixedClock(SIGN_IN_TIME);
    const accessTokens = accessTokensAt(clock);
    const accessToken = accessTokens.issue(ADMIN_ID);

    clock.advanceBy(ACCESS_TOKEN_LIFETIME_MS - 1_000);
    expect(accessTokens.adminIdFrom(accessToken)).toBe(ADMIN_ID);
    clock.advanceBy(1_000);
    expect(accessTokens.adminIdFrom(accessToken)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const clock = new FixedClock(SIGN_IN_TIME);
    const forged = accessTokensAt(
      clock,
      'another-secret-that-is-also-32-characters',
    ).issue(ADMIN_ID);

    expect(accessTokensAt(clock).adminIdFrom(forged)).toBeNull();
  });

  it('rejects an unsigned token', () => {
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString(
      'base64url',
    );
    const claims = Buffer.from(`{"sub":"${ADMIN_ID}"}`).toString('base64url');

    expect(
      accessTokensAt(new FixedClock(SIGN_IN_TIME)).adminIdFrom(
        `${header}.${claims}.`,
      ),
    ).toBeNull();
  });

  it('treats a missing token as no admin', () => {
    expect(
      accessTokensAt(new FixedClock(SIGN_IN_TIME)).adminIdFrom(undefined),
    ).toBeNull();
  });
});
