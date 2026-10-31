import {
  FetchBackend,
  HttpRequest,
  HttpResponse,
  type HttpEvent,
} from '@angular/common/http';
import { REQUEST, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Observable, of } from 'rxjs';
import { INTERNAL_API_URL, InternalApiBackend } from './internal-api.backend';

const INTERNAL = 'http://api:3000/api';

class RecordingFetch {
  readonly sent: HttpRequest<unknown>[] = [];

  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    this.sent.push(request);
    return of(new HttpResponse({ status: 200 }));
  }
}

describe('InternalApiBackend', () => {
  function send(
    url: string,
    visitorRequest: Request | null = null,
  ): HttpRequest<unknown> {
    const fetch = new RecordingFetch();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        InternalApiBackend,
        { provide: FetchBackend, useValue: fetch },
        { provide: INTERNAL_API_URL, useValue: INTERNAL },
        { provide: REQUEST, useValue: visitorRequest },
      ],
    });
    TestBed.inject(InternalApiBackend)
      .handle(new HttpRequest('GET', url))
      .subscribe();
    return fetch.sent[0];
  }

  it('sends an API call straight to the API, with the visitor’s address', () => {
    const sent = send(
      '/api/projects',
      new Request('https://underwoodstyles.ca/work', {
        headers: { 'X-Forwarded-For': '203.0.113.7' },
      }),
    );

    expect(sent.url).toBe(`${INTERNAL}/projects`);
    expect(sent.headers.get('X-Forwarded-For')).toBe('203.0.113.7');
  });

  it('recognises its own API once Angular has made the URL absolute', () => {
    const sent = send(
      'https://underwoodstyles.ca/api/projects/gateway?draft=no',
      new Request('https://underwoodstyles.ca/work/gateway'),
    );

    expect(sent.url).toBe(`${INTERNAL}/projects/gateway?draft=no`);
  });

  it('leaves another site’s API alone', () => {
    const sent = send(
      'https://example.com/api/projects',
      new Request('https://underwoodstyles.ca/work'),
    );

    expect(sent.url).toBe('https://example.com/api/projects');
  });

  it('adds no address when there is no visitor, as when prerendering', () => {
    expect(send('/api/projects').headers.has('X-Forwarded-For')).toBe(false);
  });

  it('leaves a URL outside the API alone', () => {
    expect(send('/assets/data.json').url).toBe('/assets/data.json');
  });
});
