import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProjectSummary } from '@wayfinder/domain';
import { SKILLS } from '../../content/skills';
import { SeoService } from '../../core/seo.service';
import { AVAILABILITY, PERSON } from '../../core/site.config';
import { buildPersonJsonLd } from '../../core/structured-data';
import { ProjectCard } from '../../shared/project-card';

@Component({
  selector: 'wf-home',
  imports: [RouterLink, ProjectCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero wrap">
      <p class="badge">
        <span class="dot" aria-hidden="true"></span>{{ availability }}
      </p>
      <h1>
        Hi, I’m Greg — a <span class="nowrap">full-stack</span> software
        engineer.
      </h1>
      <p class="lead">
        Twenty years across Rails, Node, Angular and AWS, from Palm Pilot sync
        protocols to OAuth servers. These days I pair that range with AI agent
        workflows to deliver what used to take a whole team.
      </p>
      <div class="actions">
        <a class="btn btn-primary" routerLink="/work">See my work</a>
        <a class="btn" routerLink="/resume">Résumé</a>
        <a class="btn" [href]="'mailto:' + person.email">Email me</a>
      </div>
    </section>

    <section class="section wrap" aria-labelledby="bring">
      <h2 id="bring">What I bring</h2>
      <div class="grid">
        <div>
          <h3>Range across the stack</h3>
          <p class="muted">
            Database schema to CSS, Rails to NestJS to Angular, AWS messaging to
            Raspberry Pi relays. Fewer hand-offs means fewer gaps.
          </p>
        </div>
        <div>
          <h3>AI agents, used with discipline</h3>
          <p class="muted">
            I set up repositories, docs and lint rules so coding agents produce
            work that survives review — and I review it as my own, because it
            is.
          </p>
        </div>
        <div>
          <h3>Production judgement</h3>
          <p class="muted">
            Authentication, migrations, rollbacks and the unglamorous parts that
            keep a system up. Two decades of shipping software and then living
            with it.
          </p>
        </div>
      </div>
    </section>

    @if (featuredProjects().length > 0) {
      <section class="section wrap" aria-labelledby="work">
        <h2 id="work">Selected work</h2>
        <div class="grid">
          @for (project of featuredProjects(); track project.slug) {
            <wf-project-card [project]="project" />
          }
        </div>
        <p class="more"><a routerLink="/work">All work →</a></p>
      </section>
    }

    <section class="section wrap" aria-labelledby="stack">
      <h2 id="stack">What I use every day</h2>
      <ul class="chips">
        @for (skill of dailySkills; track skill.name) {
          <li class="chip">{{ skill.name }}</li>
        }
      </ul>
      <p class="more">
        <a routerLink="/about" fragment="skills">The full skill set →</a>
      </p>
    </section>
  `,
  styles: `
    .hero {
      padding-block: var(--space-6) var(--space-5);
    }
    .hero h1 {
      max-width: 26ch;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 0.9rem;
      font-weight: 500;
      padding: 0.25rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      margin-bottom: var(--space-4);
    }
    .dot {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 50%;
      background: var(--accent);
    }
    .more {
      margin-top: var(--space-4);
    }
  `,
})
export class Home {
  protected readonly person = PERSON;
  protected readonly availability = AVAILABILITY;
  /** Bound from the route's resolver; empty when the API cannot be reached. */
  readonly featuredProjects = input<ProjectSummary[]>([]);
  protected readonly dailySkills = SKILLS.filter((skill) => skill.featured);

  constructor() {
    inject(SeoService).set({
      description:
        'Greg Underwood is a full-stack software engineer in BC, Canada, combining twenty years across Rails, Node, Angular and AWS with AI agent workflows. Open to remote work.',
      path: '/',
      type: 'profile',
      jsonLd: buildPersonJsonLd(),
    });
  }
}
