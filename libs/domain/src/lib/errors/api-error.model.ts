/**
 * Every failure is a real HTTP status carrying one of these codes, so the web
 * app's single error interceptor can branch on a value rather than parse a
 * message. An error inside a 200 body is never acceptable.
 */
export enum ApiErrorCode {
  ValidationFailed = 'VALIDATION_FAILED',
  /** A 4xx with no more specific code. */
  BadRequest = 'BAD_REQUEST',
  NotFound = 'NOT_FOUND',
  /** No valid session. Distinct from InvalidCredentials, which is a failed sign-in. */
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  /** Anything unexpected. The detail is in the server log, never the response. */
  Internal = 'INTERNAL',
  InvalidCredentials = 'INVALID_CREDENTIALS',
  /** Password was right; the second factor is still owed. Not a failure to show as one. */
  TotpRequired = 'TOTP_REQUIRED',
  SlugTaken = 'SLUG_TAKEN',
  RateLimited = 'RATE_LIMITED',
  UnsupportedMedia = 'UNSUPPORTED_MEDIA',
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
