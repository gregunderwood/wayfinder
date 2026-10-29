import { useTestDatabase } from '../../testing/test-database';
import { TEST_DATA_ENCRYPTION_KEY } from '../../testing/test-secrets';
import { FixedClock } from '../common/clock';
import { DataCipher } from '../common/data-cipher';
import {
  AdminAccountError,
  AdminAccountsService,
} from './admin-accounts.service';
import { AdminUserEntity, RefreshTokenEntity } from './models';
import { verifyPassword } from './passwords';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a different long passphrase';
const NOW = new Date('2026-11-02T09:00:00Z');

describe('AdminAccountsService', () => {
  const database = useTestDatabase();
  let clock: FixedClock;
  let adminAccounts: AdminAccountsService;

  beforeEach(() => {
    clock = new FixedClock(NOW);
    adminAccounts = new AdminAccountsService(
      database.dataSource.getRepository(AdminUserEntity),
      new DataCipher(TEST_DATA_ENCRYPTION_KEY),
      clock,
    );
  });

  async function storedAdmin(): Promise<AdminUserEntity> {
    const [admin] = await database.dataSource
      .getRepository(AdminUserEntity)
      .find();
    return admin;
  }

  describe('creating the admin', () => {
    it('stores the email encrypted and the password as an argon2id hash', async () => {
      await adminAccounts.createAdmin(EMAIL, PASSWORD);

      const admin = await storedAdmin();
      expect(admin.encryptedEmail).not.toContain('owner');
      expect(admin.passwordHash).toMatch(
        /^\$argon2id\$v=19\$m=19456,p=1,t=2\$/,
      );
      expect(await verifyPassword(admin.passwordHash, PASSWORD)).toBe(true);
    });

    it('lowercases the email before storing it', async () => {
      await adminAccounts.createAdmin('  Owner@Example.COM ', PASSWORD);

      expect(await adminAccounts.profileOf((await storedAdmin()).id)).toEqual(
        expect.objectContaining({ email: EMAIL }),
      );
    });

    it('refuses a second admin', async () => {
      await adminAccounts.createAdmin(EMAIL, PASSWORD);

      await expect(
        adminAccounts.createAdmin('someone@example.com', PASSWORD),
      ).rejects.toThrow(AdminAccountError);
    });

    it('cannot get a second admin past the database either', async () => {
      await adminAccounts.createAdmin(EMAIL, PASSWORD);

      await expect(
        database.dataSource
          .getRepository(AdminUserEntity)
          .insert({ encryptedEmail: 'x', passwordHash: 'x' }),
      ).rejects.toThrow(/ux_admin_users_single_admin/);
    });

    it('refuses a password shorter than twelve characters', async () => {
      await expect(
        adminAccounts.createAdmin(EMAIL, 'too-short'),
      ).rejects.toThrow('at least 12 characters');
    });
  });

  describe('resetting the password', () => {
    it('replaces the hash and signs out every session', async () => {
      await adminAccounts.createAdmin(EMAIL, PASSWORD);
      const admin = await storedAdmin();
      const refreshTokens =
        database.dataSource.getRepository(RefreshTokenEntity);
      await refreshTokens.insert({
        adminUserId: admin.id,
        familyId: crypto.randomUUID(),
        tokenHash: 'hash-of-a-live-token',
        expiresAt: new Date('2026-11-16T09:00:00Z'),
      });

      await adminAccounts.resetPassword(EMAIL, NEW_PASSWORD);

      const updated = await storedAdmin();
      expect(await verifyPassword(updated.passwordHash, NEW_PASSWORD)).toBe(
        true,
      );
      expect(await verifyPassword(updated.passwordHash, PASSWORD)).toBe(false);
      const [token] = await refreshTokens.find();
      expect(token.revokedAt).toEqual(NOW);
    });

    it('refuses when the email is not the admin’s', async () => {
      await adminAccounts.createAdmin(EMAIL, PASSWORD);

      await expect(
        adminAccounts.resetPassword('someone@example.com', NEW_PASSWORD),
      ).rejects.toThrow('There is no admin with that email');
    });

    it('refuses when there is no admin yet', async () => {
      await expect(
        adminAccounts.resetPassword(EMAIL, NEW_PASSWORD),
      ).rejects.toThrow(AdminAccountError);
    });
  });

  describe('looking the admin up', () => {
    it('finds the admin by email, ignoring case and spaces', async () => {
      await adminAccounts.createAdmin(EMAIL, PASSWORD);

      expect(
        await adminAccounts.findByEmail(' OWNER@example.com'),
      ).not.toBeNull();
      expect(await adminAccounts.findByEmail('someone@example.com')).toBeNull();
    });

    it('finds nobody before the admin exists', async () => {
      expect(await adminAccounts.findByEmail(EMAIL)).toBeNull();
      expect(
        await adminAccounts.profileOf('7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83'),
      ).toBeNull();
    });

    it('reports the last sign-in time in the profile', async () => {
      await adminAccounts.createAdmin(EMAIL, PASSWORD);
      const { id } = await storedAdmin();
      expect((await adminAccounts.profileOf(id))?.lastLoginAt).toBeNull();

      await adminAccounts.recordSignIn(id);

      expect(await adminAccounts.profileOf(id)).toEqual({
        id,
        email: EMAIL,
        lastLoginAt: NOW.toISOString(),
      });
    });
  });
});
