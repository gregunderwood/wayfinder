import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type AdminProject,
  ApiErrorCode,
  ProjectKind,
  ProjectStatus,
} from '@wayfinder/domain';
import { apiErrorInterceptor } from '../../../core/api-error.interceptor';
import { ProjectEditor } from './project-editor';

const PROJECTS_URL = '/api/admin/projects';
const NEW_PROJECT_FIELDS = {
  slug: 'tempestas',
  name: 'Tempestas',
  tagline: 'A greenhouse controller.',
  role: 'Sole developer',
  period: '2026 – present',
};

function aProject(overrides: Partial<AdminProject> = {}): AdminProject {
  return {
    id: '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83',
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
    status: ProjectStatus.Draft,
    publishedAt: null,
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-01T09:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectEditor', () => {
  let fixture: ComponentFixture<ProjectEditor>;
  let backend: HttpTestingController;

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [ProjectEditor],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: 'admin/projects/new', component: ProjectEditor },
            { path: 'admin/projects/:id', component: ProjectEditor },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  }

  async function open(project: AdminProject | null): Promise<HTMLElement> {
    configure();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProjectEditor);
    if (project) {
      showId(project.id);
      backend.expectOne(projectUrl(project.id)).flush(project);
    }
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  function showId(id: string): void {
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  function projectUrl(id: string): string {
    return `${PROJECTS_URL}/${id}`;
  }

  // The editor awaits the API between steps; let those promises run before asserting.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function submit(host: HTMLElement): Promise<void> {
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
  }

  function input(host: HTMLElement, name: string): HTMLInputElement {
    const field = host.querySelector<HTMLInputElement>(
      `[formcontrolname="${name}"]`,
    );
    if (!field) throw new Error(`no ${name} field`);
    return field;
  }

  function fillIn(host: HTMLElement, values: Record<string, string>): void {
    for (const [name, value] of Object.entries(values)) {
      const field = input(host, name);
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
  }

  afterEach(() => backend.verify());

  it('previews the body with the renderer the public page uses', async () => {
    const host = await open(aProject());

    expect(host.querySelector('.preview h2')?.textContent).toBe('Safety first');
  });

  it('locks the slug of a published project, whose slug is a live URL', async () => {
    const host = await open(aProject({ status: ProjectStatus.Published }));

    expect(input(host, 'slug').disabled).toBe(true);
    expect(host.querySelector('#slug-hint')?.textContent).toContain(
      'Unpublish to change it',
    );
  });

  it('shows a taken slug on the slug field', async () => {
    const host = await open(aProject());

    await submit(host);
    backend
      .expectOne({ method: 'PATCH' })
      .flush(
        { code: ApiErrorCode.SlugTaken, message: 'Taken' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();

    expect(input(host, 'slug').getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Another project uses this slug.');
  });

  it('lists the server’s validation messages above the form', async () => {
    const host = await open(aProject());

    await submit(host);
    backend.expectOne({ method: 'PATCH' }).flush(
      {
        code: ApiErrorCode.ValidationFailed,
        message: 'Validation failed',
        details: { errors: ['liveUrl must be a URL address'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'liveUrl must be a URL address',
    );
  });

  it('does not send a new project that misses required fields', async () => {
    const host = await open(null);

    await submit(host);

    backend.expectNone(PROJECTS_URL);
    expect(input(host, 'slug').getAttribute('aria-invalid')).toBe('true');
  });

  it('says so when the project does not exist', async () => {
    configure();
    fixture = TestBed.createComponent(ProjectEditor);
    const project = aProject();

    showId(project.id);
    backend
      .expectOne(projectUrl(project.id))
      .flush(
        { code: ApiErrorCode.NotFound, message: 'There is no such project' },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toBe('No such project');
    expect(host.querySelector('form')).toBeNull();
  });

  it('keeps the project it was moved to when an earlier load answers late', async () => {
    configure();
    fixture = TestBed.createComponent(ProjectEditor);
    const first = aProject();
    const second = aProject({
      id: '0b6f3c2a-1d4e-4f5a-8b9c-7e2d1a0f3c4b',
      name: 'Second',
    });

    showId(first.id);
    const firstLoad = backend.expectOne(projectUrl(first.id));
    showId(second.id);
    backend.expectOne(projectUrl(second.id)).flush(second);
    await settle();
    firstLoad.flush(first);
    await settle();

    const host = fixture.nativeElement as HTMLElement;
    expect(input(host, 'name').value).toBe('Second');
  });

  it('opens a created project as saved, without fetching it again', async () => {
    configure();
    const harness = await RouterTestingHarness.create('/admin/projects/new');
    const host = harness.routeNativeElement as HTMLElement;
    const created = aProject();

    fillIn(host, NEW_PROJECT_FIELDS);
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    backend.expectOne({ method: 'POST', url: PROJECTS_URL }).flush(created);
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();

    const editorHost = harness.routeNativeElement as HTMLElement;
    expect(TestBed.inject(Router).url).toBe(`/admin/projects/${created.id}`);
    expect(editorHost.textContent).toContain('Saved.');
    backend.expectNone(projectUrl(created.id));
  });
});
