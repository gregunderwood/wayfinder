import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiErrorCode } from '@wayfinder/domain';
import type { Request } from 'express';
import { AccessTokens } from './access-tokens';
import { readAccessCookie } from './session-cookies';

export interface AuthenticatedAdmin {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  admin: AuthenticatedAdmin;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly accessTokens: AccessTokens) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const adminId = this.accessTokens.adminIdFrom(readAccessCookie(request));
    if (!adminId) {
      throw new UnauthorizedException({
        code: ApiErrorCode.Unauthorized,
        message: 'Sign in to continue',
      });
    }
    request.admin = { id: adminId };
    return true;
  }
}
