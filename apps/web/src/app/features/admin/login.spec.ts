import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiErrorCode } from '@wayfinder/domain';
import { apiErrorInterceptor } from '../../core/api-error.interceptor';
import { AdminLogin } from './login';

describe('AdminLogin', () => {
  let fixture: ComponentFixture<AdminLogin>;
  let backend: HttpTestingController;
  let router: Router;

  async function render(returnUrl?: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [AdminLogin],
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
    fixture = TestBed.createComponent(AdminLogin);
    if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  async function signIn(host: HTMLElement): Promise<void> {
    for (const [name, value] of [
      ['email', 'owner@example.com'],
      ['password', 'correct horse battery staple'],
    ]) {
      const field = host.querySelector<HTMLInputElement>(
        `[formcontrolname="${name}"]`,
      );
      if (!field) throw new Error(`no ${name} field`);
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  afterEach(() => backend.verify());

  it('returns the admin to the page they were sent from', async () => {
    const host = await render('/admin/projects/abc');

    await signIn(host);
    backend
      .expectOne('/api/auth/login')
      .flush(null, { status: 204, statusText: '' });
    await settle();
    backend.expectOne('/api/auth/me').flush({
      id: 'abc',
      email: 'owner@example.com',
      lastLoginAt: null,
    });
    await settle();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/projects/abc');
  });

  it('says plainly when the email and password do not match', async () => {
    const host = await render();

    await signIn(host);
    backend
      .expectOne('/api/auth/login')
      .flush(
        { code: ApiErrorCode.InvalidCredentials, message: 'Wrong' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await settle();
    await fixture.whenStable();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'That email and password do not match.',
    );
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
