import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api-error.interceptor';
import { SIGN_IN_PATH } from '../../core/auth/admin-paths';
import { AdminSession } from '../../core/auth/admin-session';
import { AdminShell } from './admin-shell';

describe('AdminShell', () => {
  let fixture: ComponentFixture<AdminShell>;
  let backend: HttpTestingController;
  let router: Router;

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const loading = TestBed.inject(AdminSession).loadAdmin();
    backend.expectOne('/api/auth/me').flush({
      id: 'abc',
      email: 'owner@example.com',
      lastLoginAt: null,
    });
    await loading;
    fixture = TestBed.createComponent(AdminShell);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  async function signOut(host: HTMLElement): Promise<void> {
    host.querySelector('button')?.click();
    await settle();
  }

  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  afterEach(() => backend.verify());

  it('goes to sign in once the server has ended the session', async () => {
    const host = await render();

    await signOut(host);
    backend
      .expectOne('/api/auth/logout')
      .flush(null, { status: 204, statusText: '' });
    await settle();

    expect(router.navigateByUrl).toHaveBeenCalledWith(SIGN_IN_PATH);
  });

  it('stays signed in and says so when signing out fails', async () => {
    const host = await render();

    await signOut(host);
    backend.expectOne('/api/auth/logout').error(new ProgressEvent('error'));
    await settle();
    await fixture.whenStable();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Signing out failed',
    );
    expect(host.textContent).toContain('owner@example.com');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
