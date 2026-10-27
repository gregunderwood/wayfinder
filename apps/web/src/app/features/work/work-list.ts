import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { projectsInOrder } from '../../content/projects';
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
        Systems I designed and wrote end to end. My employment history — OAuth
        on Cognito, AWS messaging, a long AngularJS migration — is on the
        <a routerLink="/resume">résumé</a>.
      </p>
    </header>
    <section class="wrap section">
      <div class="grid">
        @for (project of projects; track project.slug) {
          <wf-project-card [project]="project" />
        }
      </div>
    </section>
  `,
})
export class WorkList {
  protected readonly projects = projectsInOrder();

  constructor() {
    inject(SeoService).set({
      title: 'Work',
      description:
        'Projects by Greg Underwood: a community-centre platform with AI-drafted meeting minutes, a multi-node greenhouse controller, and this site.',
      path: '/work',
    });
  }
}
