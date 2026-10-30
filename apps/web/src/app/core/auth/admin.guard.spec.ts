import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  type Route,
  Router,
  UrlSegment,
  type UrlTree,
} from '@angular/router';
import type { AdminProfile } from '@wayfinder/domain';
import { adminGuard } from './admin.guard';
import { AdminSession } from './admin-session';

const ADMIN: AdminProfile = {
  id: '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83',
  email: 'owner@example.com',
  lastLoginAt: null,
};

type SessionCheck = AdminProfile | null | Error;

class StubSession {
  constructor(private readonly check: SessionCheck) {}

  loadAdmin(): Promise<AdminProfile | null> {
    return this.check instanceof Error
      ? Promise.reject(this.check)
      : Promise.resolve(this.check);
  }
}

describe('adminGuard', () => {
  function runGuard(
    admin: SessionCheck,
    path: string[],
  ): Promise<boolean | UrlTree> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AdminSession, useValue: new StubSession(admin) },
      ],
    });
    const segments = path.map((part) => new UrlSegment(part, {}));
    return TestBed.runInInjectionContext(
      () => adminGuard({} as Route, segments) as Promise<boolean | UrlTree>,
    );
  }

  it('lets a signed-in admin through', async () => {
    expect(await runGuard(ADMIN, ['admin', 'projects'])).toBe(true);
  });

  it('sends anyone else to sign in, remembering where they were going', async () => {
    const result = await runGuard(null, ['admin', 'projects', 'abc']);

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      '/admin/login?returnUrl=%2Fadmin%2Fprojects%2Fabc',
    );
  });

  it('sends the admin to sign in when the session cannot be checked', async () => {
    const result = await runGuard(new Error('Server unreachable'), ['admin']);

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      '/admin/login?returnUrl=%2Fadmin',
    );
  });
});
