import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiError, ApiErrorCode } from '@wayfinder/domain';
import type { Response } from 'express';

type ErrorResponse = [status: number, body: ApiError];

interface ThrownResponse {
  code?: ApiErrorCode;
  message?: string | string[];
  details?: Record<string, unknown>;
}

interface NormalisedResponse {
  code?: ApiErrorCode;
  message?: string;
  details?: Record<string, unknown>;
  validationErrors?: string[];
}

const CODE_FOR_STATUS: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ApiErrorCode.ValidationFailed,
  [HttpStatus.UNAUTHORIZED]: ApiErrorCode.Unauthorized,
  [HttpStatus.FORBIDDEN]: ApiErrorCode.Forbidden,
  [HttpStatus.NOT_FOUND]: ApiErrorCode.NotFound,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ApiErrorCode.UnsupportedMedia,
  [HttpStatus.TOO_MANY_REQUESTS]: ApiErrorCode.RateLimited,
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const [status, body] = this.toErrorResponse(exception);
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }

  toErrorResponse(exception: unknown): ErrorResponse {
    const errorResponse =
      exception instanceof HttpException
        ? this.fromHttpException(exception)
        : this.fromUnexpectedError();
    const [status] = errorResponse;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(describeForLog(exception));
    }
    return errorResponse;
  }

  private fromHttpException(exception: HttpException): ErrorResponse {
    const status = exception.getStatus();
    const exceptionResponse = readExceptionResponse(exception);
    const code = exceptionResponse.code ?? defaultCodeForStatus(status);

    if (exceptionResponse.validationErrors) {
      return [
        status,
        {
          code,
          message: 'Validation failed',
          details: { errors: exceptionResponse.validationErrors },
        },
      ];
    }
    return [
      status,
      {
        code,
        message: exceptionResponse.message ?? exception.message,
        ...(exceptionResponse.details && {
          details: exceptionResponse.details,
        }),
      },
    ];
  }

  private fromUnexpectedError(): ErrorResponse {
    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      { code: ApiErrorCode.Internal, message: 'Internal server error' },
    ];
  }
}

function readExceptionResponse(exception: HttpException): NormalisedResponse {
  const thrown = exception.getResponse();
  if (typeof thrown === 'string') {
    return { message: thrown };
  }
  const { code, message, details } = thrown as ThrownResponse;
  return Array.isArray(message)
    ? { code, details, validationErrors: message }
    : { code, details, message };
}

function defaultCodeForStatus(status: number): ApiErrorCode {
  return (
    CODE_FOR_STATUS[status] ??
    (status >= HttpStatus.INTERNAL_SERVER_ERROR
      ? ApiErrorCode.Internal
      : ApiErrorCode.BadRequest)
  );
}

function describeForLog(exception: unknown): string {
  return exception instanceof Error
    ? (exception.stack ?? exception.message)
    : String(exception);
}
