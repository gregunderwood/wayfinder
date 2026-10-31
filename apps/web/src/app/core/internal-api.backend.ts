import {
  FetchBackend,
  type HttpBackend,
  type HttpEvent,
  type HttpRequest,
} from '@angular/common/http';
import { Injectable, InjectionToken, REQUEST, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PATH } from './api.service';

export const INTERNAL_API_URL = new InjectionToken<string>('INTERNAL_API_URL');

/**
 * Server-only: sends API calls straight to the API inside the Compose network, not out through
 * Caddy. A backend rather than an interceptor, because it must run after the HTTP transfer cache,
 * which keys responses by the URL the browser will ask for. By then Angular's server platform has
 * made relative URLs absolute against the page being rendered, so both forms are matched.
 */
@Injectable()
export class InternalApiBackend implements HttpBackend {
  private readonly fetchBackend = inject(FetchBackend);
  private readonly internalApiUrl = inject(INTERNAL_API_URL);
  private readonly visitorRequest = inject(REQUEST, { optional: true });

  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const apiPath = this.ownApiPath(request.url);
    return this.fetchBackend.handle(
      apiPath === null ? request : this.toInternal(request, apiPath),
    );
  }

  // The path and query of a call to this site's own API, or null for anything else.
  private ownApiPath(url: string): string | null {
    const pageOrigin = this.visitorRequest
      ? new URL(this.visitorRequest.url).origin
      : null;
    const parsed = new URL(url, pageOrigin ?? 'http://relative.invalid');
    const isOwnOrigin =
      parsed.origin === pageOrigin || !/^[a-z][a-z\d+.-]*:/i.test(url);
    return isOwnOrigin && parsed.pathname.startsWith(`${API_PATH}/`)
      ? parsed.pathname.slice(API_PATH.length) + parsed.search
      : null;
  }

  private toInternal(
    request: HttpRequest<unknown>,
    apiPath: string,
  ): HttpRequest<unknown> {
    const visitorAddress =
      this.visitorRequest?.headers.get('x-forwarded-for') ?? null;
    return request.clone({
      url: this.internalApiUrl + apiPath,
      // The API rate-limits per client; without this, every visitor shares the web server's limit.
      setHeaders: visitorAddress ? { 'X-Forwarded-For': visitorAddress } : {},
    });
  }
}
