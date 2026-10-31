import { HttpErrorResponse } from '@angular/common/http';
import {
  PLATFORM_ID,
  RESPONSE_INIT,
  TransferState,
  makeStateKey,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiErrorCode } from '@wayfinder/domain';
import { toApiRequestError } from './api-request-error';
import { loadPageData } from './page-data';

const KEY = '/work/gateway';
const FAILURE_KEY = makeStateKey<unknown>(`page-data:${KEY}`);

describe('loadPageData', () => {
  function configure(
    platform: 'server' | 'browser',
    responseInit: ResponseInit | null,
  ): TransferState {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    });
    return TestBed.inject(TransferState);
  }

  function load<Content>(loader: () => Promise<Content>): Promise<unknown> {
    return TestBed.runInInjectionContext(() => loadPageData(KEY, loader));
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
    configure('server', {});

    expect(await load(() => Promise.resolve(['a']))).toEqual({
      status: 'ready',
      content: ['a'],
    });
  });

  it('answers 404 for a missing record', async () => {
    const responseInit: ResponseInit = {};
    configure('server', responseInit);

    const page = await load(failingWith(404, ApiErrorCode.NotFound));

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
      configure('server', responseInit);

      const page = await load(loader);

      expect(page).toEqual({ status: 'unavailable' });
      expect(responseInit.status).toBe(503);
      expect(new Headers(responseInit.headers).get('Retry-After')).toBe('60');
    },
  );

  it('keeps the headers Angular already set on the response', async () => {
    const responseInit: ResponseInit = {
      headers: new Headers({ 'Content-Type': 'text/html;charset=UTF-8' }),
    };
    configure('server', responseInit);

    await load(failingWith(0));

    expect(new Headers(responseInit.headers).get('Content-Type')).toBe(
      'text/html;charset=UTF-8',
    );
  });

  it('sends a failure to the browser with the page', async () => {
    const transferState = configure('server', {});

    await load(failingWith(0));

    expect(transferState.get(FAILURE_KEY, null)).toEqual({
      status: 'unavailable',
    });
  });

  it('shows the server’s failure in the browser instead of asking again, once', async () => {
    const transferState = configure('browser', null);
    transferState.set(FAILURE_KEY, { status: 'not-found' });
    const loader = vi.fn(() => Promise.resolve('fresh'));

    expect(await load(loader)).toEqual({ status: 'not-found' });
    expect(loader).not.toHaveBeenCalled();
    expect(await load(loader)).toEqual({ status: 'ready', content: 'fresh' });
  });

  it('remembers no failure of its own in the browser', async () => {
    const transferState = configure('browser', null);

    expect(await load(failingWith(0))).toEqual({ status: 'unavailable' });
    expect(transferState.hasKey(FAILURE_KEY)).toBe(false);
  });
});
