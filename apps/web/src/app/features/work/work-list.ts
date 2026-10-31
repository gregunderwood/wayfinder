import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProjectSummary } from '@wayfinder/domain';
import type { PageData } from '../../core/page-data';
import { SeoService } from '../../core/seo.service';
import { ProjectCard } from '../../shared/project-card';

@Component({
  selector: 'wf-work-list',
  imports: [RouterLink, ProjectCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head wrap">
      <p class="eyebrow">Work</p>
      <h1>Things I’ve built</h1>
      <p class="lead">
        Systems I designed and wrote — at work, as a volunteer, and for myself.
        The rest of my history is on the <a routerLink="/resume">résumé</a>.
      </p>
    </header>
    <section class="wrap section">
      @if (projects(); as projects) {
        <div class="grid">
          @for (project of projects; track project.slug) {
            <wf-project-card [project]="project" />
          }
        </div>
      } @else {
        <p class="lead" role="status">
          The projects could not be loaded just now. Try again in a minute.
        </p>
      }
    </section>
  `,
})
export class WorkList {
  /** Bound from the route's resolver. */
  readonly page = input.required<PageData<ProjectSummary[]>>();

  protected readonly projects = computed(() => {
    const page = this.page();
    return page.status === 'ready' ? page.content : null;
  });

  constructor() {
    inject(SeoService).set({
      title: 'Work',
      description:
        'Projects by Greg Underwood: the Gateway single sign-on portal, a community-centre platform with AI-drafted meeting minutes, and a multi-node greenhouse controller.',
      path: '/work',
    });
  }
}
