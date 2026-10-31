import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  type AdminProject,
  ApiErrorCode,
  PROJECT_TAGLINE_MAX_LENGTH,
  ProjectKind,
  ProjectStatus,
} from '@wayfinder/domain';
import { ApiService } from '../../../core/api.service';
import {
  type ApiRequestError,
  toApiRequestError,
} from '../../../core/api-request-error';
import { ADMIN_HOME_PATH } from '../../../core/auth/admin-paths';
import { renderMarkdown } from '../../../core/markdown';
import { SeoService } from '../../../core/seo.service';
import { PROJECT_KIND_LABELS } from '../../../shared/project-kind-labels';
import { adminPageSeo } from '../admin-page';
import { buildProjectForm, toFormValue, toPayload } from './project-form';

type LoadState = 'loading' | 'ready' | 'missing' | 'failed';

const CREATED_PROJECT = 'createdProject';

@Component({
  selector: 'wf-project-editor',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap page-head">
      <p><a routerLink="/admin/projects">← All projects</a></p>
      @switch (loadState()) {
        @case ('loading') {
          <p class="muted" aria-live="polite">Loading…</p>
        }
        @case ('missing') {
          <h1>No such project</h1>
          <p class="lead">It may have been deleted.</p>
        }
        @case ('failed') {
          <h1>Could not load the project</h1>
          <p class="form-error" role="alert">{{ formErrors()[0] }}</p>
        }
        @default {
          <h1>{{ saved()?.name ?? 'New project' }}</h1>
          <form class="editor" [formGroup]="form" (ngSubmit)="save()">
            @if (formErrors().length > 0) {
              <ul class="form-error" role="alert">
                @for (message of formErrors(); track message) {
                  <li>{{ message }}</li>
                }
              </ul>
            }

            <div class="fields">
              <label class="field">
                <span>Name</span>
                <input formControlName="name" />
              </label>

              <label class="field">
                <span>Slug</span>
                <input
                  formControlName="slug"
                  aria-describedby="slug-hint"
                  [attr.aria-invalid]="showsError('slug')"
                />
                <small id="slug-hint" class="muted">
                  @if (isSlugLocked()) {
                    Published at /work/{{ form.controls.slug.value }}. Unpublish
                    to change it; old links will then 404.
                  } @else {
                    Lowercase words joined by hyphens: /work/your-slug
                  }
                </small>
                @if (form.controls.slug.hasError('slugTaken')) {
                  <small class="field-error"
                    >Another project uses this slug.</small
                  >
                } @else if (showsError('slug')) {
                  <small class="field-error"
                    >Use lowercase letters, digits and single hyphens.</small
                  >
                }
              </label>

              <label class="field">
                <span>Tagline</span>
                <input
                  formControlName="tagline"
                  aria-describedby="tagline-count"
                  [attr.aria-invalid]="showsError('tagline')"
                />
                <small id="tagline-count" class="muted"
                  >{{ taglineLength() }} / {{ taglineLimit }}, also the page's
                  search description</small
                >
              </label>

              <div class="field-row">
                <label class="field">
                  <span>Kind</span>
                  <select formControlName="kind">
                    @for (kind of kinds; track kind) {
                      <option [value]="kind">{{ kindLabels[kind] }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span>Status</span>
                  <select formControlName="status">
                    <option [value]="statuses.Draft">Draft</option>
                    <option [value]="statuses.Published">Published</option>
                  </select>
                </label>
              </div>

              <div class="field-row">
                <label class="field">
                  <span>Role</span>
                  <input formControlName="role" />
                </label>
                <label class="field">
                  <span>Period</span>
                  <input
                    formControlName="period"
                    placeholder="2024 – present"
                  />
                </label>
              </div>

              <label class="field">
                <span>Stack</span>
                <input
                  formControlName="stack"
                  placeholder="NestJS, PostgreSQL"
                />
                <small class="muted">Separated by commas</small>
              </label>

              <label class="field">
                <span>Live site</span>
                <input type="url" formControlName="liveUrl" />
              </label>
              <label class="field">
                <span>Repository</span>
                <input type="url" formControlName="repoUrl" />
              </label>
              <label class="field">
                <span>Public docs</span>
                <input type="url" formControlName="docsUrl" />
              </label>

              <div class="field-row">
                <label class="field">
                  <span>Order</span>
                  <input type="number" min="0" formControlName="sortOrder" />
                </label>
                <label class="field checkbox">
                  <input type="checkbox" formControlName="featured" />
                  <span>Featured on the home page</span>
                </label>
              </div>
            </div>

            <div class="body">
              <label class="field">
                <span>Body (Markdown)</span>
                <textarea formControlName="bodyMarkdown" rows="24"></textarea>
              </label>
              <div>
                <p class="eyebrow">Preview</p>
                <div class="prose preview" [innerHTML]="preview()"></div>
              </div>
            </div>

            <div class="actions">
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="saving()"
              >
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
              @if (saved(); as project) {
                @if (confirmingDelete()) {
                  <button
                    type="button"
                    class="btn btn-danger"
                    (click)="remove(project)"
                  >
                    Delete for good
                  </button>
                  <button
                    type="button"
                    class="btn"
                    (click)="confirmingDelete.set(false)"
                  >
                    Keep it
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn"
                    (click)="confirmingDelete.set(true)"
                  >
                    Delete…
                  </button>
                }
              }
              <p class="muted" aria-live="polite">{{ savedMessage() }}</p>
            </div>
          </form>
        }
      }
    </section>
  `,
  styles: `
    .editor {
      display: grid;
      gap: var(--space-4);
    }
    .fields {
      display: grid;
      gap: var(--space-3);
      max-width: 44rem;
    }
    .body {
      display: grid;
      gap: var(--space-4);
    }
    @media (min-width: 64rem) {
      .body {
        grid-template-columns: 1fr 1fr;
      }
    }
    .preview {
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      padding: var(--space-3);
      min-height: 100%;
    }
  `,
})
export class ProjectEditor {
  /** Bound from the :id route parameter; absent on /admin/projects/new. */
  readonly id = input<string>();

  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly form = buildProjectForm(inject(NonNullableFormBuilder));
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly saved = signal<AdminProject | null>(null);
  protected readonly saving = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly savedMessage = signal('');
  protected readonly confirmingDelete = signal(false);
  // A create moves from the /new route to /:id, which builds a new editor; this hands it the project.
  private readonly createdProject = this.router.currentNavigation()?.extras
    .state?.[CREATED_PROJECT] as AdminProject | undefined;

  protected readonly kinds = Object.values(ProjectKind);
  protected readonly kindLabels = PROJECT_KIND_LABELS;
  protected readonly statuses = ProjectStatus;
  protected readonly taglineLimit = PROJECT_TAGLINE_MAX_LENGTH;

  private readonly bodyMarkdown = toSignal(
    this.form.controls.bodyMarkdown.valueChanges,
    { initialValue: '' },
  );
  private readonly tagline = toSignal(this.form.controls.tagline.valueChanges, {
    initialValue: '',
  });
  protected readonly preview = computed(() =>
    renderMarkdown(this.bodyMarkdown()),
  );
  protected readonly taglineLength = computed(() => this.tagline().length);
  protected readonly isSlugLocked = computed(
    () => this.saved()?.status === ProjectStatus.Published,
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  protected showsError(control: 'slug' | 'tagline'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formErrors.set([]);
    this.savedMessage.set('');
    try {
      const payload = toPayload(this.form.getRawValue());
      const existing = this.saved();
      if (existing) {
        this.showSaved(await this.api.updateProject(existing.id, payload));
      } else {
        await this.openCreated(await this.api.createProject(payload));
      }
    } catch (error) {
      this.showSaveFailure(toApiRequestError(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(project: AdminProject): Promise<void> {
    try {
      await this.api.deleteProject(project.id);
      await this.router.navigateByUrl(ADMIN_HOME_PATH);
    } catch (error) {
      this.confirmingDelete.set(false);
      this.formErrors.set([toApiRequestError(error).message]);
    }
  }

  private async load(id: string | undefined): Promise<void> {
    this.clearMessages();
    if (!id) {
      this.seo.set(adminPageSeo('New project', `${ADMIN_HOME_PATH}/new`));
      this.loadState.set('ready');
      return;
    }
    if (this.createdProject?.id === id) {
      this.showSaved(this.createdProject);
      this.loadState.set('ready');
      return;
    }
    this.loadState.set('loading');
    try {
      const project = await this.api.adminProject(id);
      if (this.isStillShowing(id)) {
        this.showProject(project);
        this.loadState.set('ready');
      }
    } catch (error) {
      if (this.isStillShowing(id)) {
        this.showLoadFailure(toApiRequestError(error));
      }
    }
  }

  private isStillShowing(id: string): boolean {
    return this.id() === id;
  }

  private clearMessages(): void {
    this.formErrors.set([]);
    this.savedMessage.set('');
    this.confirmingDelete.set(false);
  }

  private showProject(project: AdminProject): void {
    this.saved.set(project);
    this.form.reset(toFormValue(project));
    if (this.isSlugLocked()) {
      this.form.controls.slug.disable();
    } else {
      this.form.controls.slug.enable();
    }
    this.seo.set(
      adminPageSeo(project.name, `${ADMIN_HOME_PATH}/${project.id}`),
    );
  }

  private showSaved(project: AdminProject): void {
    this.showProject(project);
    this.savedMessage.set('Saved.');
  }

  private async openCreated(project: AdminProject): Promise<void> {
    await this.router.navigate([ADMIN_HOME_PATH, project.id], {
      replaceUrl: true,
      state: { [CREATED_PROJECT]: project },
    });
  }

  private showLoadFailure(failure: ApiRequestError): void {
    if (failure.is(ApiErrorCode.NotFound)) {
      this.loadState.set('missing');
      return;
    }
    this.formErrors.set([failure.message]);
    this.loadState.set('failed');
  }

  private showSaveFailure(failure: ApiRequestError): void {
    if (failure.is(ApiErrorCode.SlugTaken)) {
      this.form.controls.slug.setErrors({ slugTaken: true });
      this.form.controls.slug.markAsTouched();
      return;
    }
    this.formErrors.set(
      failure.validationErrors.length > 0
        ? failure.validationErrors
        : [failure.message],
    );
  }
}
