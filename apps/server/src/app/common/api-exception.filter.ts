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

/** Used when a thrown HttpException did not name its own code. */
const CODE_BY_STATUS: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ApiErrorCode.ValidationFailed,
  [HttpStatus.UNAUTHORIZED]: ApiErrorCode.Unauthorized,
  [HttpStatus.FORBIDDEN]: ApiErrorCode.Forbidden,
  [HttpStatus.NOT_FOUND]: ApiErrorCode.NotFound,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ApiErrorCode.UnsupportedMedia,
  [HttpStatus.TOO_MANY_REQUESTS]: ApiErrorCode.RateLimited,
};

/**
 * Every error response is an `ApiError`, so the web app's one interceptor
 * branches on `code` instead of on whichever shape Nest, the ValidationPipe or
 * a hand-thrown exception happened to produce.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.toApiError(exception);
    response.status(status).json(body);
  }

  toApiError(exception: unknown): [number, ApiError] {
    if (!(exception instanceof HttpException)) {
      // The detail goes to the log, never the client: a stack trace or a SQL
      // message tells an attacker more than it tells a visitor.
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
      );
      return [
        HttpStatus.INTERNAL_SERVER_ERROR,
        { code: ApiErrorCode.Internal, message: 'Internal server error' },
      ];
    }

    const status = exception.getStatus();
    const raw = exception.getResponse();
    const fields: Partial<ApiError> & { message?: string | string[] } =
      typeof raw === 'string' ? { message: raw } : (raw as Partial<ApiError>);
    const code =
      fields.code ??
      CODE_BY_STATUS[status] ??
      (status >= 500 ? ApiErrorCode.Internal : ApiErrorCode.BadRequest);

    // The ValidationPipe reports one message per failed constraint.
    if (Array.isArray(fields.message)) {
      return [
        status,
        {
          code,
          message: 'Validation failed',
          details: { errors: fields.message },
        },
      ];
    }
    return [
      status,
      {
        code,
        message: fields.message ?? exception.message,
        ...(fields.details && { details: fields.details }),
      },
    ];
  }
}
