import { RESPONSE_INIT, inject } from '@angular/core';
import { ApiErrorCode } from '@wayfinder/domain';
import { toApiRequestError } from './api-request-error';

export type PageData<Content> =
  | { status: 'ready'; content: Content }
  | { status: 'not-found' }
  | { status: 'unavailable' };

const RETRY_AFTER_SECONDS = '60';

/**
 * Loads what a page shows. A missing record answers 404; anything else answers 503, never 404,
 * so an outage does not tell search engines the page is gone.
 */
export async function loadPageData<Content>(
  load: () => Promise<Content>,
): Promise<PageData<Content>> {
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  try {
    return { status: 'ready', content: await load() };
  } catch (error) {
    if (toApiRequestError(error).is(ApiErrorCode.NotFound)) {
      if (responseInit) responseInit.status = 404;
      return { status: 'not-found' };
    }
    if (responseInit) {
      responseInit.status = 503;
      responseInit.headers = { 'Retry-After': RETRY_AFTER_SECONDS };
    }
    return { status: 'unavailable' };
  }
}
