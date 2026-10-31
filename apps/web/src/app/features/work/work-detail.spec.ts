import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { RESPONSE_INIT, provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminSession } from '../../core/auth/admin-session';
import { WorkDetail } from './work-detail';

const PROJECT_ID = '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83';

describe('WorkDetail', () => {
  let fixture: ComponentFixture<WorkDetail>;

  function configure(responseInit: ResponseInit | null = null): void {
    TestBed.configureTestingModule({
      imports: [WorkDetail],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    });
  }

  function render(
    slug: string,
    responseInit: ResponseInit | null = null,
  ): HTMLElement {
    configure(responseInit);
    return show(slug);
  }

  function show(slug: string): HTMLElement {
    fixture = TestBed.createComponent(WorkDetail);
    fixture.componentRef.setInput('slug', slug);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a project and its markdown body', () => {
    const host = render('tempestas');
    expect(host.querySelector('h1')?.textContent).toBe('Tempestas');
    expect(host.querySelector('.prose h2')).not.toBeNull();
  });

  it('answers 404 for an unknown slug instead of a soft 200', () => {
    const responseInit: ResponseInit = {};
    const host = render('does-not-exist', responseInit);
    expect(host.querySelector('h1')?.textContent).toBe('No such project');
    expect(responseInit.status).toBe(404);
  });

  it('offers a signed-in admin a link to the project’s editor', async () => {
    configure();
    const backend = TestBed.inject(HttpTestingController);
    const signingIn = TestBed.inject(AdminSession).loadAdmin();
    backend.expectOne('/api/auth/me').flush({
      id: 'abc',
      email: 'owner@example.com',
      lastLoginAt: null,
    });
    await signingIn;

    const host = show('tempestas');
    await fixture.whenStable();
    backend
      .expectOne('/api/admin/projects/by-slug/tempestas')
      .flush({ id: PROJECT_ID });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    const edit = host.querySelector<HTMLAnchorElement>('.back a.btn');
    expect(edit?.textContent?.trim()).toBe('Edit this project');
    expect(edit?.getAttribute('href')).toBe(`/admin/projects/${PROJECT_ID}`);
    backend.verify();
  });

  it('offers a visitor no edit link, and asks the API nothing', () => {
    const host = render('tempestas');

    expect(host.querySelector('.back a.btn')).toBeNull();
    TestBed.inject(HttpTestingController).verify();
  });
});
