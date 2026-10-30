import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiErrorCode } from '@wayfinder/domain';
import { inject } from 'vitest';
import { useTestDatabase } from '../../testing/test-database';
import {
  TEST_DATA_ENCRYPTION_KEY,
  TEST_JWT_SECRET,
} from '../../testing/test-secrets';
import { AppModule } from '../app.module';
import { SystemClock } from '../common/clock';
import { DataCipher } from '../common/data-cipher';
import { configureApp } from '../configure-app';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminUserEntity } from './models';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './session-cookies';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct horse battery staple';
const LOGINS_ALLOWED_PER_MINUTE = 5;

interface ApiRequest {
  body?: unknown;
  cookies?: Record<string, string>;
  contentType?: string;
  clientIp?: string;
}

interface ApiResponse {
  status: number;
  body: unknown;
  setCookies: string[];
}

describe('auth API', () => {
  const database = useTestDatabase();
  let app: NestExpressApplication;
  let baseUrl: string;
  let nextClientIp = 1;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    stubTestEnvironment(String(database.dataSource.options.database));
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
    });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = `${await app.getUrl()}/api`;
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await new AdminAccountsService(
      database.dataSource.getRepository(AdminUserEntity),
      new DataCipher(TEST_DATA_ENCRYPTION_KEY),
      new SystemClock(),
    ).createAdmin(EMAIL, PASSWORD);
  });

  function stubTestEnvironment(databaseName: string): void {
    const server = inject('testDatabaseServer');
    vi.stubEnv('DATABASE_HOST', server.host);
    vi.stubEnv('DATABASE_PORT', String(server.port));
    vi.stubEnv('DATABASE_USER', server.username);
    vi.stubEnv('DATABASE_PASSWORD', server.password);
    vi.stubEnv('DATABASE_NAME', databaseName);
    vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
    vi.stubEnv('DATA_ENCRYPTION_KEY', TEST_DATA_ENCRYPTION_KEY.toString('hex'));
  }

  // Each test is its own client, so one test's rate limit cannot spill into the next.
  function newClientIp(): string {
    return `203.0.113.${nextClientIp++}`;
  }

  async function send(
    method: 'GET' | 'POST',
    path: string,
    {
      body,
      cookies = {},
      contentType = 'application/json',
      clientIp = newClientIp(),
    }: ApiRequest = {},
  ): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': contentType,
        'x-forwarded-for': clientIp,
        cookie: Object.entries(cookies)
          .map(([name, value]) => `${name}=${value}`)
          .join('; '),
      },
      body:
        body === undefined
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      setCookies: response.headers.getSetCookie(),
    };
  }

  function cookieValues(setCookies: string[]): Record<string, string> {
    return Object.fromEntries(
      setCookies.map((setCookie) => {
        const [nameAndValue] = setCookie.split(';');
        const separator = nameAndValue.indexOf('=');
        return [
          nameAndValue.slice(0, separator),
          nameAndValue.slice(separator + 1),
        ];
      }),
    );
  }

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
