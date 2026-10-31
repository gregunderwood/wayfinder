import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Project } from '@wayfinder/domain';
import { AdminSession } from '../../core/auth/admin-session';
import { renderMarkdown } from '../../core/markdown';
import type { PageData } from '../../core/page-data';
import { SeoService } from '../../core/seo.service';
import { buildProjectJsonLd } from '../../core/structured-data';
import { PROJECT_KIND_LABELS } from '../../shared/project-kind-labels';
import { EditProjectLink } from '../admin/shortcuts/edit-project-link';

@Component({
  selector: 'wf-work-detail',
  imports: [RouterLink, EditProjectLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (project(); as project) {
      <article>
        <header class="page-head wrap">
          <p class="back">
            <a routerLink="/work">← All work</a>
            @if (session.admin()) {
              @defer (on immediate) {
                <wf-edit-project-link [slug]="project.slug" />
              }
            }
          </p>
          <p class="eyebrow">{{ kindLabels[project.kind] }}</p>
          <h1>{{ project.name }}</h1>
          <p class="lead">{{ project.tagline }}</p>
          <dl class="facts">
            <div>
              <dt>Role</dt>
              <dd>{{ project.role }}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{{ project.period }}</dd>
            </div>
            @if (project.docsUrl) {
              <div>
                <dt>Docs</dt>
                <dd>
                  <a [href]="project.docsUrl" rel="noopener">{{
                    displayHost(project.docsUrl)
                  }}</a>
                </dd>
              </div>
            }
            @if (project.liveUrl) {
              <div>
                <dt>Live</dt>
                <dd>
                  <a [href]="project.liveUrl" rel="noopener">{{
                    displayHost(project.liveUrl)
                  }}</a>
                </dd>
              </div>
            }
          </dl>
          <ul class="chips" aria-label="Stack">
            @for (technology of project.stack; track technology) {
              <li class="chip">{{ technology }}</li>
            }
          </ul>
        </header>
        <div class="wrap section">
          <div class="prose" [innerHTML]="body()"></div>
        </div>
      </article>
    } @else if (page().status === 'unavailable') {
      <section class="page-head wrap">
        <h1>This page is unavailable</h1>
        <p class="lead">
          The project could not be loaded just now. Try again in a minute, or
          <a routerLink="/work">see all work</a>.
        </p>
      </section>
    } @else {
      <section class="page-head wrap">
        <h1>No such project</h1>
        <p class="lead">
          That link may be out of date. <a routerLink="/work">See all work</a>.
        </p>
      </section>
    }
  `,
  styles: `
    .back {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3) var(--space-5);
      margin: var(--space-4) 0;
    }
    dt {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    dd {
      margin: 0;
      font-weight: 500;
    }
  `,
})
export class WorkDetail {
  /** Bound from the :slug route parameter by withComponentInputBinding. */
  readonly slug = input.required<string>();
  /** Bound from the route's resolver. */
  readonly page = input.required<PageData<Project>>();

  protected readonly project = computed(() => {
    const page = this.page();
    return page.status === 'ready' ? page.content : undefined;
  });
  protected readonly body = computed(() => {
    const project = this.project();
    return project ? renderMarkdown(project.bodyMarkdown) : '';
  });
  protected readonly kindLabels = PROJECT_KIND_LABELS;

  protected readonly session = inject(AdminSession);
  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      const project = this.project();
      if (project) {
        this.describeProject(project);
      } else {
        this.describeMissingPage();
      }
    });
  }

  private describeProject(project: Project): void {
    this.seo.set({
      title: project.name,
      description: project.tagline,
      path: `/work/${project.slug}`,
      type: 'article',
      jsonLd: buildProjectJsonLd(project),
    });
  }

  private describeMissingPage(): void {
    const isUnavailable = this.page().status === 'unavailable';
    this.seo.set({
      title: isUnavailable ? 'Unavailable' : 'Not found',
      description: isUnavailable
        ? 'This project could not be loaded just now.'
        : 'This project does not exist.',
      path: `/work/${this.slug()}`,
      noindex: true,
    });
  }

  protected displayHost(url: string): string {
    return new URL(url).host;
  }
}
