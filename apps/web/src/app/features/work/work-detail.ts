import {
  ChangeDetectionStrategy,
  Component,
  RESPONSE_INIT,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Project } from '@wayfinder/domain';
import { PROJECT_KIND_LABELS, findProject } from '../../content/projects';
import { renderMarkdown } from '../../core/markdown';
import { SeoService } from '../../core/seo.service';
import { buildProjectJsonLd } from '../../core/structured-data';

@Component({
  selector: 'wf-work-detail',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (project(); as project) {
      <article>
        <header class="page-head wrap">
          <p class="back"><a routerLink="/work">← All work</a></p>
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

  protected readonly project = computed(() => findProject(this.slug()));
  protected readonly body = computed(() => {
    const project = this.project();
    return project ? renderMarkdown(project.bodyMarkdown) : '';
  });
  protected readonly kindLabels = PROJECT_KIND_LABELS;

  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  constructor() {
    effect(() => {
      const project = this.project();
      if (project) {
        this.describeProject(project);
      } else {
        this.answerNotFound();
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

  private answerNotFound(): void {
    if (this.responseInit) this.responseInit.status = 404;
    this.seo.set({
      title: 'Not found',
      description: 'This project does not exist.',
      path: `/work/${this.slug()}`,
      noindex: true,
    });
  }

  protected displayHost(url: string): string {
    return new URL(url).host;
  }
}
