import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_TOKEN_LIFETIME_MS,
  type IssuedSession,
  REFRESH_TOKEN_LIFETIME_MS,
} from './session';

export const ACCESS_COOKIE = 'wf_access';
export const REFRESH_COOKIE = 'wf_refresh';

const ACCESS_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/api',
};

// /api/auth rather than /api/auth/refresh: logout needs the token too, to revoke its family.
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/auth',
};

export function setSessionCookies(
  response: Response,
  session: IssuedSession,
): void {
  response.cookie(ACCESS_COOKIE, session.accessToken, {
    ...ACCESS_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_LIFETIME_MS,
  });
  response.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_LIFETIME_MS,
  });
}

export function clearSessionCookies(response: Response): void {
  response.clearCookie(ACCESS_COOKIE, ACCESS_COOKIE_OPTIONS);
  response.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
}

export function readAccessCookie(request: Request): string | undefined {
  return readCookie(request, ACCESS_COOKIE);
}

export function readRefreshCookie(request: Request): string | undefined {
  return readCookie(request, REFRESH_COOKIE);
}

function readCookie(request: Request, name: string): string | undefined {
  const cookies: Record<string, unknown> = request.cookies ?? {};
  const value = cookies[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}
