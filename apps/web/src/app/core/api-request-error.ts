import { HttpErrorResponse } from '@angular/common/http';
import { type ApiError, ApiErrorCode } from '@wayfinder/domain';

const UNREACHABLE_STATUS = 0;

export class ApiRequestError extends Error implements ApiError {
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    readonly status: number,
    { code, message, details }: ApiError,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.details = details;
  }

  is(code: ApiErrorCode): boolean {
    return this.code === code;
  }

  get validationErrors(): string[] {
    const errors = this.details?.['errors'];
    return Array.isArray(errors)
      ? errors.filter((error): error is string => typeof error === 'string')
      : [];
  }
}

export function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiRequestError(UNREACHABLE_STATUS, {
      code: ApiErrorCode.Internal,
      message: 'Something went wrong',
    });
  }
  if (isApiError(error.error)) {
    return new ApiRequestError(error.status, error.error);
  }
  return new ApiRequestError(error.status, {
    code: ApiErrorCode.Internal,
    message:
      error.status === UNREACHABLE_STATUS
        ? 'The server could not be reached'
        : 'The server answered with an unexpected error',
  });
}

function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ApiError).code === 'string' &&
    typeof (body as ApiError).message === 'string'
  );
}
