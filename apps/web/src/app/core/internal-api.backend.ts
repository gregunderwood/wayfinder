import {
  FetchBackend,
  type HttpEvent,
  type HttpRequest,
} from '@angular/common/http';
import { Injectable, InjectionToken, REQUEST, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PATH } from './api.service';

export const INTERNAL_API_URL = new InjectionToken<string>('INTERNAL_API_URL');
export const INTERNAL_API_TIMEOUT_MS = 5_000;
const RELATIVE_URL_BASE = 'http://relative.invalid';

// Server-only. A backend, not an interceptor, so the transfer cache keys responses by the public URL.
@Injectable()
export class InternalApiBackend extends FetchBackend {
  private readonly internalApiUrl = inject(INTERNAL_API_URL);
  private readonly visitorRequest = inject(REQUEST, { optional: true });

  override handle(
    request: HttpRequest<unknown>,
  ): Observable<HttpEvent<unknown>> {
    const apiPath = this.ownApiPath(request.url);
    return super.handle(
      apiPath === null ? request : this.toInternal(request, apiPath),
    );
  }

  // Angular's server platform has already made relative URLs absolute against the page.
  private ownApiPath(url: string): string | null {
    const pageOrigin = this.visitorRequest
      ? new URL(this.visitorRequest.url).origin
      : RELATIVE_URL_BASE;
    const parsed = new URL(url, pageOrigin);
    return parsed.origin === pageOrigin &&
      parsed.pathname.startsWith(`${API_PATH}/`)
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
      timeout: INTERNAL_API_TIMEOUT_MS,
      // The API rate-limits per client; without this, every visitor shares the web server's limit.
      setHeaders: visitorAddress ? { 'X-Forwarded-For': visitorAddress } : {},
    });
  }
}
