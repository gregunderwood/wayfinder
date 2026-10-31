import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { featuredProjectsResolver } from './project-resolvers';

describe('featuredProjectsResolver', () => {
  function resolve(): {
    result: Promise<unknown>;
    backend: HttpTestingController;
  } {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const result = TestBed.runInInjectionContext(() =>
      featuredProjectsResolver(
        {} as ActivatedRouteSnapshot,
        { url: '/' } as RouterStateSnapshot,
      ),
    ) as Promise<unknown>;
    return { result, backend };
  }

  it('keeps only the featured projects', async () => {
    const { result, backend } = resolve();

    backend.expectOne('/api/projects').flush([
      { slug: 'gateway', featured: true },
      { slug: 'tempestas', featured: false },
    ]);

    expect(await result).toEqual([{ slug: 'gateway', featured: true }]);
  });

  it('gives the home page no projects, rather than an error, when the API is down', async () => {
    const { result, backend } = resolve();

    backend.expectOne('/api/projects').error(new ProgressEvent('error'));

    expect(await result).toEqual([]);
  });
});
