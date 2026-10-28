import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Project } from '@wayfinder/domain';
import { PROJECT_KIND_LABELS } from '../content/projects';

const CARD_STACK_LIMIT = 5;

@Component({
  selector: 'wf-project-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <p class="eyebrow">
        {{ kindLabels[project().kind] }} · {{ project().period }}
      </p>
      <h3>
        <a [routerLink]="['/work', project().slug]">{{ project().name }}</a>
      </h3>
      <p class="muted">{{ project().tagline }}</p>
      <ul class="chips" aria-label="Stack">
        @for (technology of visibleStack(); track technology) {
          <li class="chip">{{ technology }}</li>
        }
      </ul>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      height: 100%;
      position: relative;
    }
    h3 a {
      color: var(--text);
      text-decoration: none;
    }
    /* Stretches the heading link over the card so a screen reader hears one link, not three. */
    h3 a::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .card:hover {
      border-color: var(--accent);
    }
    .card:hover h3 a {
      color: var(--accent);
    }
  `,
})
export class ProjectCard {
  readonly project = input.required<Project>();
  protected readonly visibleStack = computed(() =>
    this.project().stack.slice(0, CARD_STACK_LIMIT),
  );
  protected readonly kindLabels = PROJECT_KIND_LABELS;
}
