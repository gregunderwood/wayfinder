import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminSession } from './admin-session';

describe('AdminSession', () => {
  it('shares one request between callers that ask at the same time', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(AdminSession);
    const admin = {
      id: 'abc',
      email: 'owner@example.com',
      lastLoginAt: null,
    };

    const fromGuard = session.loadAdmin();
    const fromPublicPage = session.loadAdmin();
    backend.expectOne('/api/auth/me').flush(admin);

    expect(await Promise.all([fromGuard, fromPublicPage])).toEqual([
      admin,
      admin,
    ]);
    backend.verify();
  });
});
