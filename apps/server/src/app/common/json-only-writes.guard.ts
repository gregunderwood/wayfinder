import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ApiErrorCode } from '@wayfinder/domain';
import type { Request } from 'express';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const JSON_MEDIA_TYPE = 'application/json';

// A cross-site HTML form cannot send application/json without a preflight, which fails with no CORS.
@Injectable()
export class JsonOnlyWritesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!WRITE_METHODS.has(request.method) || isJson(request)) {
      return true;
    }
    throw new UnsupportedMediaTypeException({
      code: ApiErrorCode.UnsupportedMedia,
      message: `Send ${request.method} requests as ${JSON_MEDIA_TYPE}`,
    });
  }
}

function isJson(request: Request): boolean {
  const [mediaType] = (request.headers['content-type'] ?? '').split(';');
  return mediaType.trim().toLowerCase() === JSON_MEDIA_TYPE;
}
