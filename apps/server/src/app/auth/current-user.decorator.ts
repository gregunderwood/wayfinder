import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedAdmin, AuthenticatedRequest } from './admin.guard';

export const CurrentUser = createParamDecorator(
  (_unused: unknown, context: ExecutionContext): AuthenticatedAdmin =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().admin,
);
