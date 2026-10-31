import { isPlatformServer } from '@angular/common';
import {
  PLATFORM_ID,
  RESPONSE_INIT,
  TransferState,
  inject,
  makeStateKey,
} from '@angular/core';
import { ApiErrorCode } from '@wayfinder/domain';
import { toApiRequestError } from './api-request-error';

type PageFailure = { status: 'not-found' } | { status: 'unavailable' };

export type PageData<Content> =
  { status: 'ready'; content: Content } | PageFailure;

export const RETRY_AFTER_SECONDS = '60';

/** A missing record answers 404; anything else 503, so an outage does not unlist the page. */
export async function loadPageData<Content>(
  key: string,
  load: () => Promise<Content>,
): Promise<PageData<Content>> {
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const page = await loadContent(key, load);
  if (responseInit) {
    describeStatus(page, responseInit);
  }
  return page;
}

// The HTTP transfer cache keeps only successes, so a failure travels with the page; otherwise the
// browser would ask again and could render something other than what the server sent.
export async function loadContent<Content>(
  key: string,
  load: () => Promise<Content>,
): Promise<PageData<Content>> {
  const transferState = inject(TransferState);
  const isServer = isPlatformServer(inject(PLATFORM_ID));
  const failureKey = makeStateKey<PageFailure>(`page-data:${key}`);

  const serverFailure = transferState.get(failureKey, null);
  if (serverFailure) {
    transferState.remove(failureKey);
    return serverFailure;
  }
  try {
    return { status: 'ready', content: await load() };
  } catch (error) {
    const failure: PageFailure = toApiRequestError(error).is(
      ApiErrorCode.NotFound,
    )
      ? { status: 'not-found' }
      : { status: 'unavailable' };
    if (isServer) {
      transferState.set(failureKey, failure);
    }
    return failure;
  }
}

function describeStatus(
  page: PageData<unknown>,
  responseInit: ResponseInit,
): void {
  if (page.status === 'not-found') {
    responseInit.status = 404;
  } else if (page.status === 'unavailable') {
    const headers = new Headers(responseInit.headers);
    headers.set('Retry-After', RETRY_AFTER_SECONDS);
    responseInit.status = 503;
    responseInit.headers = headers;
  }
}
