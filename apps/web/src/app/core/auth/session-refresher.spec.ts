import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { REFRESH_LOCK, SessionRefresher } from './session-refresher';

const REFRESH_URL = '/api/auth/refresh';

// Web Locks as another tab sees them: callers under one name run one at a time.
class SharedLocks {
  private turns = new Map<string, Promise<unknown>>();

  request<Result>(
    name: string,
    callback: () => Promise<Result>,
  ): Promise<Result> {
    const previous = this.turns.get(name) ?? Promise.resolve();
    const turn = previous.then(callback, callback);
    this.turns.set(
      name,
      turn.catch(() => undefined),
    );
    return turn;
  }
}

describe('SessionRefresher', () => {
  let backend: HttpTestingController;
  let refresher: SessionRefresher;
  let locks: SharedLocks;

  beforeEach(() => {
    locks = new SharedLocks();
    Object.defineProperty(navigator, 'locks', {
      value: locks,
      configurable: true,
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    refresher = TestBed.inject(SessionRefresher);
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
    backend.verify();
  });

  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  it('waits for another tab’s refresh, so it presents the token that one issued', async () => {
    let finishOtherTab!: () => void;
    void locks.request(
      REFRESH_LOCK,
      () => new Promise<void>((resolve) => (finishOtherTab = resolve)),
    );

    const refreshing = refresher.refresh();
    await settle();
    backend.expectNone(REFRESH_URL);

    finishOtherTab();
    await settle();
    backend.expectOne(REFRESH_URL).flush(null, { status: 204, statusText: '' });
    await refreshing;
  });

  it('shares one refresh between requests in this tab', async () => {
    const first = refresher.refresh();
    const second = refresher.refresh();
    await settle();

    backend.expectOne(REFRESH_URL).flush(null, { status: 204, statusText: '' });
    await Promise.all([first, second]);
  });
});
