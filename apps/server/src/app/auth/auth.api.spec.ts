import { ApiErrorCode } from '@wayfinder/domain';
import { cookieValues, useTestApp } from '../../testing/test-app';
import { useTestDatabase } from '../../testing/test-database';
import { TEST_DATA_ENCRYPTION_KEY } from '../../testing/test-secrets';
import { SystemClock } from '../common/clock';
import { DataCipher } from '../common/data-cipher';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminUserEntity } from './models';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './session-cookies';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct horse battery staple';
const LOGINS_ALLOWED_PER_MINUTE = 5;

describe('auth API', () => {
  const database = useTestDatabase();
  const { send, newClientIp } = useTestApp(database);

  beforeEach(async () => {
    await new AdminAccountsService(
      database.dataSource.getRepository(AdminUserEntity),
      new DataCipher(TEST_DATA_ENCRYPTION_KEY),
      new SystemClock(),
    ).createAdmin(EMAIL, PASSWORD);
  });

  function setCookieFor(setCookies: string[], name: string): string {
    return (
      setCookies.find((setCookie) => setCookie.startsWith(`${name}=`)) ?? ''
    );
  }

  async function signIn(): Promise<Record<string, string>> {
    const response = await send('POST', '/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(response.status).toBe(204);
    return cookieValues(response.setCookies);
  }

  it('signs in with two HttpOnly, Secure cookies scoped to the API', async () => {
    const response = await send('POST', '/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
    });

    expect(response.status).toBe(204);
    const accessCookie = setCookieFor(response.setCookies, ACCESS_COOKIE);
    const refreshCookie = setCookieFor(response.setCookies, REFRESH_COOKIE);
    expect(accessCookie).toMatch(/; Max-Age=900;/);
    expect(accessCookie).toMatch(/; Path=\/api;/);
    expect(accessCookie).toMatch(/; HttpOnly; Secure; SameSite=Lax$/);
    expect(refreshCookie).toMatch(/; Max-Age=1209600;/);
    expect(refreshCookie).toMatch(/; Path=\/api\/auth;/);
    expect(refreshCookie).toMatch(/; HttpOnly; Secure; SameSite=Strict$/);
  });

  it('returns the profile to a signed-in admin', async () => {
    const cookies = await signIn();

    const response = await send('GET', '/auth/me', { cookies });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: expect.any(String),
      email: EMAIL,
      lastLoginAt: expect.any(String),
    });
  });

  it.each([
    ['no cookie', {}],
    ['a forged cookie', { [ACCESS_COOKIE]: 'not.a.jwt' }],
  ])('refuses the profile with %s', async (_case, cookies) => {
    const response = await send('GET', '/auth/me', { cookies });

    expect(response.status).toBe(401);
    expect(response.body).toEqual(
      expect.objectContaining({ code: ApiErrorCode.Unauthorized }),
    );
  });

  it('answers a wrong password with InvalidCredentials and sets no cookie', async () => {
    const response = await send('POST', '/auth/login', {
      body: { email: EMAIL, password: 'not the password at all' },
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual(
      expect.objectContaining({ code: ApiErrorCode.InvalidCredentials }),
    );
    expect(response.setCookies).toEqual([]);
  });

  it('refuses a write that is not JSON, as a cross-site form would send it', async () => {
    const response = await send('POST', '/auth/login', {
      contentType: 'application/x-www-form-urlencoded',
      body: `email=${EMAIL}&password=${PASSWORD}`,
    });

    expect(response.status).toBe(415);
    expect(response.body).toEqual(
      expect.objectContaining({ code: ApiErrorCode.UnsupportedMedia }),
    );
  });

  it('rejects a malformed login with the validation errors', async () => {
    const response = await send('POST', '/auth/login', {
      body: { email: 'not-an-email', password: PASSWORD, isAdmin: true },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({ code: ApiErrorCode.ValidationFailed }),
    );
  });

  it('limits sign-in attempts per client, as seen through the proxy', async () => {
    const attacker = newClientIp();
    const wrongPassword = { email: EMAIL, password: 'guess number n' };
    for (let attempt = 0; attempt < LOGINS_ALLOWED_PER_MINUTE; attempt++) {
      const response = await send('POST', '/auth/login', {
        body: wrongPassword,
        clientIp: attacker,
      });
      expect(response.status).toBe(401);
    }

    const blocked = await send('POST', '/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
      clientIp: attacker,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual(
      expect.objectContaining({ code: ApiErrorCode.RateLimited }),
    );

    const someoneElse = await send('POST', '/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(someoneElse.status).toBe(204);
  });

  it('rotates the refresh cookie, and ends the session on logout', async () => {
    const signedIn = await signIn();

    const refreshed = await send('POST', '/auth/refresh', {
      cookies: signedIn,
    });
    expect(refreshed.status).toBe(204);
    const rotated = cookieValues(refreshed.setCookies);
    expect(rotated[REFRESH_COOKIE]).not.toBe(signedIn[REFRESH_COOKIE]);

    const loggedOut = await send('POST', '/auth/logout', { cookies: rotated });
    expect(loggedOut.status).toBe(204);
    expect(cookieValues(loggedOut.setCookies)).toEqual({
      [ACCESS_COOKIE]: '',
      [REFRESH_COOKIE]: '',
    });

    const afterLogout = await send('POST', '/auth/refresh', {
      cookies: rotated,
    });
    expect(afterLogout.status).toBe(401);
  });
});
