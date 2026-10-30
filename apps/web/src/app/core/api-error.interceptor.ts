import {
  HttpContextToken,
  type HttpEvent,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiErrorCode } from '@wayfinder/domain';
import { catchError, from, type Observable, switchMap, throwError } from 'rxjs';
import { ApiRequestError, toApiRequestError } from './api-request-error';
import { REDIRECT_TO_SIGN_IN } from './api.service';
import { SIGN_IN_PATH } from './auth/admin-paths';
import { AdminSession } from './auth/admin-session';
import { SessionRefresher } from './auth/session-refresher';

const ENDPOINTS_THAT_CANNOT_BE_REFRESHED = [
  '/api/auth/login',
  '/api/auth/refresh',
];
const IS_RETRY = new HttpContextToken<boolean>(() => false);

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const refresher = inject(SessionRefresher);
  const router = inject(Router);
  const session = inject(AdminSession);

  return next(request).pipe(
    catchError((error: unknown) => {
      const failure = toApiRequestError(error);
      if (!canRecoverByRefreshing(request, failure)) {
        return throwError(() => failure);
      }
      return from(refresher.refresh()).pipe(
        catchError(() => {
          session.forget();
          if (request.context.get(REDIRECT_TO_SIGN_IN)) {
            void router.navigate([SIGN_IN_PATH], {
              queryParams: { returnUrl: router.url },
            });
          }
          return throwError(() => failure);
        }),
        switchMap(() => retry(request, next)),
      );
    }),
  );
};

function canRecoverByRefreshing(
  request: HttpRequest<unknown>,
  failure: ApiRequestError,
): boolean {
  return (
    failure.is(ApiErrorCode.Unauthorized) &&
    !request.context.get(IS_RETRY) &&
    !ENDPOINTS_THAT_CANNOT_BE_REFRESHED.includes(request.url)
  );
}

function retry(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const retried = request.clone({
    context: request.context.set(IS_RETRY, true),
  });
  return next(retried).pipe(
    catchError((error: unknown) => throwError(() => toApiRequestError(error))),
  );
}
