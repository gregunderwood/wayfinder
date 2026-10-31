import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';

const PROJECT_ID = '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83';

describe('ApiService', () => {
  let api: ApiService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(ApiService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  // The API refuses any write that is not JSON, including the ones with nothing to send.
  it.each([
    ['signing out', 'POST', '/api/auth/logout', () => api.signOut()],
    ['refreshing', 'POST', '/api/auth/refresh', () => api.refreshSession()],
    [
      'deleting a project',
      'DELETE',
      `/api/admin/projects/${PROJECT_ID}`,
      () => api.deleteProject(PROJECT_ID),
    ],
  ])('sends JSON when %s', async (_case, method, url, write) => {
    const pending = write();

    const request = backend.expectOne({ method, url });
    expect(request.request.detectContentTypeHeader()).toBe('application/json');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
  });
});
