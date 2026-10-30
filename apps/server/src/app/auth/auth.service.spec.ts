import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiErrorCode } from '@wayfinder/domain';
import { useTestDatabase } from '../../testing/test-database';
import {
  TEST_DATA_ENCRYPTION_KEY,
  TEST_JWT_SECRET,
} from '../../testing/test-secrets';
import { FixedClock } from '../common/clock';
import { DataCipher } from '../common/data-cipher';
import { AccessTokens } from './access-tokens';
import { AdminAccountsService } from './admin-accounts.service';
import { AuthService } from './auth.service';
import { AdminUserEntity, RefreshTokenEntity } from './models';
import { hashRefreshToken } from './refresh-tokens';
import { REFRESH_TOKEN_LIFETIME_MS } from './session';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct horse battery staple';
const NOW = new Date('2026-11-02T09:00:00Z');

describe('AuthService', () => {
  const database = useTestDatabase();
  let clock: FixedClock;
  let accessTokens: AccessTokens;
  let auth: AuthService;

  beforeEach(async () => {
    clock = new FixedClock(NOW);
    accessTokens = new AccessTokens(
      new JwtService({ secret: TEST_JWT_SECRET }),
      clock,
    );
    const adminAccounts = new AdminAccountsService(
      database.dataSource.getRepository(AdminUserEntity),
      new DataCipher(TEST_DATA_ENCRYPTION_KEY),
      clock,
    );
    auth = new AuthService(
      adminAccounts,
      database.dataSource.getRepository(RefreshTokenEntity),
      accessTokens,
      clock,
    );
    await adminAccounts.createAdmin(EMAIL, PASSWORD);
  });

  async function rejectionOf(attempt: Promise<unknown>): Promise<{
    status: number;
    code: unknown;
  }> {
    const error = await attempt.then(
      () => {
        throw new Error('expected the attempt to be rejected');
      },
      (rejection: unknown) => rejection,
    );
    expect(error).toBeInstanceOf(UnauthorizedException);
    const exception = error as UnauthorizedException;
    const { code } = exception.getResponse() as { code: unknown };
    return { status: exception.getStatus(), code };
  }

  async function storedTokenFor(
    refreshToken: string,
  ): Promise<RefreshTokenEntity> {
    return database.dataSource
      .getRepository(RefreshTokenEntity)
      .findOneByOrFail({ tokenHash: hashRefreshToken(refreshToken) });
  }

  describe('signing in', () => {
    it('issues an access token for the admin and records the sign-in', async () => {
      const session = await auth.login(EMAIL, PASSWORD);

      const adminId = accessTokens.adminIdFrom(session.accessToken);
      expect(adminId).not.toBeNull();
      expect((await auth.profileOf(adminId ?? '')).lastLoginAt).toBe(
        NOW.toISOString(),
      );
    });

    it('stores only the hash of the refresh token, for fourteen days', async () => {
      const session = await auth.login(EMAIL, PASSWORD);

      const stored = await storedTokenFor(session.refreshToken);
      expect(stored.tokenHash).not.toBe(session.refreshToken);
      expect(stored.expiresAt).toEqual(
        new Date(NOW.getTime() + REFRESH_TOKEN_LIFETIME_MS),
      );
    });

    it('accepts the email in any case', async () => {
      await expect(auth.login('Owner@Example.com', PASSWORD)).resolves.toEqual(
        expect.objectContaining({ refreshToken: expect.any(String) }),
      );
    });

    it.each([
      ['a wrong password', EMAIL, 'not the password at all'],
      ['an unknown email', 'someone@example.com', PASSWORD],
    ])('gives the same answer for %s', async (_case, email, password) => {
      expect(await rejectionOf(auth.login(email, password))).toEqual({
        status: HttpStatus.UNAUTHORIZED,
        code: ApiErrorCode.InvalidCredentials,
      });
    });
  });

  describe('refreshing', () => {
    it('rotates the refresh token within the same family', async () => {
      const first = await auth.login(EMAIL, PASSWORD);

      const second = await auth.refresh(first.refreshToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      const [old, rotated] = await Promise.all([
        storedTokenFor(first.refreshToken),
        storedTokenFor(second.refreshToken),
      ]);
      expect(old.revokedAt).toEqual(NOW);
      expect(rotated.revokedAt).toBeNull();
      expect(rotated.familyId).toBe(old.familyId);
    });

    it('treats a reused token as stolen and ends the whole family', async () => {
      const first = await auth.login(EMAIL, PASSWORD);
      const second = await auth.refresh(first.refreshToken);

      expect((await rejectionOf(auth.refresh(first.refreshToken))).code).toBe(
        ApiErrorCode.Unauthorized,
      );
      await rejectionOf(auth.refresh(second.refreshToken));
    });

    it('leaves other sign-ins alone when one family is ended', async () => {
      const laptop = await auth.login(EMAIL, PASSWORD);
      const phone = await auth.login(EMAIL, PASSWORD);
      await auth.refresh(laptop.refreshToken);

      await rejectionOf(auth.refresh(laptop.refreshToken));

      await expect(auth.refresh(phone.refreshToken)).resolves.toBeDefined();
    });

    it('refuses a token after its fourteen days', async () => {
      const session = await auth.login(EMAIL, PASSWORD);

      clock.advanceBy(REFRESH_TOKEN_LIFETIME_MS);

      await rejectionOf(auth.refresh(session.refreshToken));
    });

    it.each([undefined, '', 'never-issued'])(
      'refuses %j',
      async (presentedToken) => {
        await rejectionOf(auth.refresh(presentedToken));
      },
    );
  });

  describe('signing out', () => {
    it('ends the family, so its refresh token stops working', async () => {
      const first = await auth.login(EMAIL, PASSWORD);
      const second = await auth.refresh(first.refreshToken);

      await auth.logout(second.refreshToken);

      await rejectionOf(auth.refresh(second.refreshToken));
    });

    it('succeeds without a token', async () => {
      await expect(auth.logout(undefined)).resolves.toBeUndefined();
    });
  });

  it('ends the session when the admin no longer exists', async () => {
    await rejectionOf(auth.profileOf('7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83'));
  });
});
