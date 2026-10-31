import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  Component,
  DOCUMENT,
  provideZonelessChangeDetection,
} from '@angular/core';
import { Location } from '@angular/common';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SIGNED_IN_HINT_COOKIE } from '@wayfinder/domain';
import { App } from './app';
import { apiErrorInterceptor } from './core/api-error.interceptor';

@Component({ template: '' })
class BlankPage {}

const ADMIN = {
  id: '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83',
  email: 'owner@example.com',
  lastLoginAt: null,
};

describe('App shell', () => {
  let fixture: ComponentFixture<App>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'work', component: BlankPage },
          { path: 'admin/projects', component: BlankPage },
        ]),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    setSignedInHint(false);
    backend.verify();
  });

  function setSignedInHint(isPresent: boolean): void {
    TestBed.inject(DOCUMENT).cookie = isPresent
      ? `${SIGNED_IN_HINT_COOKIE}=1`
      : `${SIGNED_IN_HINT_COOKIE}=; max-age=0`;
  }

  function render(): HTMLElement {
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  // Lets the session check, and the deferred bar's chunk, finish before asserting.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function renderSignedIn(url: string): Promise<HTMLElement> {
    setSignedInHint(true);
    await TestBed.inject(Router).navigateByUrl(url);
    const host = render();
    await fixture.whenStable();
    backend.expectOne('/api/auth/me').flush(ADMIN);
    await settle();
    return host;
  }

  function footerText(host: HTMLElement): string {
    return host.querySelector('footer')?.textContent ?? '';
  }

  it('offers a skip link that targets the main landmark', () => {
    const host = render();
    const skipLink = host.querySelector<HTMLAnchorElement>('a.skip-link');
    expect(skipLink?.getAttribute('href')).toBe('#main');
    expect(host.querySelector('main#main')).not.toBeNull();
  });

  it('labels the primary navigation and links every top-level page', () => {
    const nav = render().querySelector('nav[aria-label="Primary"]');
    const labels = Array.from(nav?.querySelectorAll('a') ?? []).map((link) =>
      link.textContent?.trim(),
    );
    expect(labels).toEqual(['Work', 'About', 'Résumé', 'Contact']);
  });

  it('never prints a street address or phone number', () => {
    const text = render().textContent ?? '';
    expect(text).not.toMatch(/\(\d{3}\)\s*\d{3}-\d{4}/);
    expect(text).not.toMatch(/Meadow Creek Road|PO \d+/i);
  });

  it('offers a visitor the admin sign-in in the footer, without asking the API anything', async () => {
    const host = render();
    await settle();

    const signIn = host.querySelector<HTMLAnchorElement>('footer a[rel]');
    expect(signIn?.textContent).toBe('Admin sign in');
    expect(signIn?.getAttribute('href')).toBe('/admin/login');
    expect(signIn?.getAttribute('rel')).toBe('nofollow');
    expect(host.querySelector('wf-signed-in-bar')).toBeNull();
  });

  it('shows a signed-in admin the admin bar instead of the sign-in link', async () => {
    const host = await renderSignedIn('/work');

    const bar = host.querySelector('aside[aria-label="Admin"]');
    expect(bar?.textContent).toContain('Signed in as owner@example.com');
    expect(bar?.querySelector('a')?.getAttribute('href')).toBe(
      '/admin/projects',
    );
    expect(footerText(host)).not.toContain('Admin sign in');
  });

  it('leaves the bar to the admin pages, which have their own', async () => {
    const host = await renderSignedIn('/admin/projects');

    expect(host.querySelector('wf-signed-in-bar')).toBeNull();
    expect(footerText(host)).not.toContain('Admin sign in');
  });

  it('knows an admin page from the address bar before the router has finished navigating', async () => {
    TestBed.inject(Location).go('/admin/projects');
    const host = render();
    await settle();

    expect(footerText(host)).not.toContain('Admin sign in');
  });
});
