import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { inject } from 'vitest';
import { AppModule } from '../app/app.module';
import { configureApp } from '../app/configure-app';
import type { TestDatabase } from './test-database';
import { TEST_DATA_ENCRYPTION_KEY, TEST_JWT_SECRET } from './test-secrets';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ApiRequest {
  body?: unknown;
  cookies?: Record<string, string>;
  contentType?: string;
  clientIp?: string;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  setCookies: string[];
}

export interface TestApp {
  send(
    method: HttpMethod,
    path: string,
    request?: ApiRequest,
  ): Promise<ApiResponse>;
  newClientIp(): string;
}

export function useTestApp(database: TestDatabase): TestApp {
  let app: NestExpressApplication | undefined;
  let baseUrl = '';
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
    await app?.close();
    vi.unstubAllEnvs();
  });

  // Each call is its own client, so one test's rate limit cannot spill into the next.
  function newClientIp(): string {
    return `203.0.113.${nextClientIp++}`;
  }

  async function send(
    method: HttpMethod,
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
        cookie: toCookieHeader(cookies),
      },
      body: toRequestBody(body),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      setCookies: response.headers.getSetCookie(),
    };
  }

  return { send, newClientIp };
}

export function cookieValues(setCookies: string[]): Record<string, string> {
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

function toCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function toRequestBody(body: unknown): string | undefined {
  if (body === undefined) {
    return undefined;
  }
  return typeof body === 'string' ? body : JSON.stringify(body);
}
