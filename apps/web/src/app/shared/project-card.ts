import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Project } from '@wayfinder/domain';
import { PROJECT_KIND_LABELS } from '../content/projects';

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
        @for (item of project().stack.slice(0, 5); track item) {
          <li class="chip">{{ item }}</li>
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
    /* The whole card is the click target; the heading link stays the only
       focusable element so a screen reader hears one link, not three. */
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
  protected readonly kindLabels = PROJECT_KIND_LABELS;
}
