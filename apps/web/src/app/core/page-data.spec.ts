import { HttpErrorResponse } from '@angular/common/http';
import { RESPONSE_INIT, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiErrorCode } from '@wayfinder/domain';
import { toApiRequestError } from './api-request-error';
import { loadPageData } from './page-data';

describe('loadPageData', () => {
  function load<Content>(
    loader: () => Promise<Content>,
    responseInit: ResponseInit | null,
  ): Promise<unknown> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    });
    return TestBed.runInInjectionContext(() => loadPageData(loader));
  }

  function failingWith(
    status: number,
    code?: ApiErrorCode,
  ): () => Promise<never> {
    const failure = toApiRequestError(
      new HttpErrorResponse({
        status,
        error: code ? { code, message: 'test' } : null,
      }),
    );
    return () => Promise.reject(failure);
  }

  it('hands the page its content', async () => {
    expect(await load(() => Promise.resolve(['a']), {})).toEqual({
      status: 'ready',
      content: ['a'],
    });
  });

  it('answers 404 for a missing record', async () => {
    const responseInit: ResponseInit = {};

    const page = await load(
      failingWith(404, ApiErrorCode.NotFound),
      responseInit,
    );

    expect(page).toEqual({ status: 'not-found' });
    expect(responseInit.status).toBe(404);
  });

  it.each([
    ['the API cannot be reached', failingWith(0)],
    ['the API fails', failingWith(500, ApiErrorCode.Internal)],
  ])(
    'answers 503 with Retry-After, never 404, when %s',
    async (_case, loader) => {
      const responseInit: ResponseInit = {};

      const page = await load(loader, responseInit);

      expect(page).toEqual({ status: 'unavailable' });
      expect(responseInit.status).toBe(503);
      expect(responseInit.headers).toEqual({ 'Retry-After': '60' });
    },
  );

  it('sets no status in the browser, where there is no response to shape', async () => {
    expect(await load(failingWith(0), null)).toEqual({ status: 'unavailable' });
  });
});
