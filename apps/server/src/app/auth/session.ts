const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const ACCESS_TOKEN_LIFETIME_MS = 15 * MINUTE_MS;
export const REFRESH_TOKEN_LIFETIME_MS = 14 * DAY_MS;

export const LOGIN_RATE_LIMIT = { limit: 5, ttl: MINUTE_MS };
export const REFRESH_RATE_LIMIT = { limit: 30, ttl: MINUTE_MS };
export const GLOBAL_RATE_LIMIT = { limit: 300, ttl: MINUTE_MS };

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
}
