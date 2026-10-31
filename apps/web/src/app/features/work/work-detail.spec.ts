import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { type Project, ProjectKind } from '@wayfinder/domain';
import { AdminSession } from '../../core/auth/admin-session';
import type { PageData } from '../../core/page-data';
import { WorkDetail } from './work-detail';

const PROJECT_ID = '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83';
const TEMPESTAS: Project = {
  slug: 'tempestas',
  name: 'Tempestas',
  tagline: 'A greenhouse controller.',
  kind: ProjectKind.Personal,
  role: 'Sole developer',
  period: '2026 – present',
  stack: ['NestJS'],
  bodyMarkdown: '## Safety first',
  featured: false,
  sortOrder: 0,
};

describe('WorkDetail', () => {
  let fixture: ComponentFixture<WorkDetail>;

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [WorkDetail],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
  }

  function render(slug: string, page: PageData<Project>): HTMLElement {
    configure();
    return show(slug, page);
  }

  function show(slug: string, page: PageData<Project>): HTMLElement {
    fixture = TestBed.createComponent(WorkDetail);
    fixture.componentRef.setInput('slug', slug);
    fixture.componentRef.setInput('page', page);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function robots(): string | undefined {
    return TestBed.inject(Meta).getTag('name="robots"')?.content;
  }

  it('renders a project and its markdown body', () => {
    const host = render('tempestas', { status: 'ready', content: TEMPESTAS });

    expect(host.querySelector('h1')?.textContent).toBe('Tempestas');
    expect(host.querySelector('.prose h2')?.textContent).toBe('Safety first');
    expect(robots()).toBe('index, follow');
  });

  it('says a missing project is missing, and keeps it out of search', () => {
    const host = render('does-not-exist', { status: 'not-found' });

    expect(host.querySelector('h1')?.textContent).toBe('No such project');
    expect(robots()).toBe('noindex, nofollow');
  });

  it('says the page is unavailable, not missing, when the project cannot be loaded', () => {
    const host = render('tempestas', { status: 'unavailable' });

    expect(host.querySelector('h1')?.textContent).toBe(
      'This page is unavailable',
    );
    expect(robots()).toBe('noindex, nofollow');
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

    const host = show('tempestas', { status: 'ready', content: TEMPESTAS });
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
    const host = render('tempestas', { status: 'ready', content: TEMPESTAS });

    expect(host.querySelector('.back a.btn')).toBeNull();
    TestBed.inject(HttpTestingController).verify();
  });
});
