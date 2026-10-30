import { inject } from '@angular/core';
import { type CanMatchFn, Router, type UrlTree } from '@angular/router';
import { SIGN_IN_PATH } from './admin-paths';
import { AdminSession } from './admin-session';

export const adminGuard: CanMatchFn = async (
  _route,
  segments,
): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const session = inject(AdminSession);
  const admin = await session.loadAdmin().catch(() => null);
  if (admin) {
    return true;
  }
  const attemptedUrl = `/${segments.map((segment) => segment.path).join('/')}`;
  return router.createUrlTree([SIGN_IN_PATH], {
    queryParams: { returnUrl: attemptedUrl },
  });
};
