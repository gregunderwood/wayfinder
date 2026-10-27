/**
 * Every failure is a real HTTP status carrying one of these codes, so the web
 * app's single error interceptor can branch on a value rather than parse a
 * message. An error inside a 200 body is never acceptable.
 */
export enum ApiErrorCode {
  ValidationFailed = 'VALIDATION_FAILED',
  NotFound = 'NOT_FOUND',
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
