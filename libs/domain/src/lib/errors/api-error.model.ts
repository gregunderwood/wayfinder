export enum ApiErrorCode {
  ValidationFailed = 'VALIDATION_FAILED',
  /** Any 4xx without a more specific code. */
  BadRequest = 'BAD_REQUEST',
  NotFound = 'NOT_FOUND',
  /** No valid session; a failed sign-in is InvalidCredentials. */
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  Internal = 'INTERNAL',
  InvalidCredentials = 'INVALID_CREDENTIALS',
  /** The password was right; a two-factor code is still owed. */
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
