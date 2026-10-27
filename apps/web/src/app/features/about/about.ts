import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo.service';
import { personJsonLd } from '../../core/structured-data';
import { SkillMatrix } from '../../shared/skill-matrix';

@Component({
  selector: 'wf-about',
  imports: [RouterLink, SkillMatrix],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head wrap">
      <p class="eyebrow">About</p>
      <h1>A generalist, on purpose.</h1>
    </header>

    <section class="wrap">
      <div class="prose">
        <p>
          I started my career in 2005 writing sync protocols for the Palm and
          BlackBerry apps that medical residents and surgeons used to log their
          cases, and I have been shipping software ever since: the BlackBerry
          event guide for the Vancouver 2010 Olympics, white-label marketplaces
          for VMware and Cisco, and most recently an enterprise
          visitor-management platform at Sign In Solutions, where I built
          authentication, messaging and access-control integrations.
        </p>
        <p>
          I have worked in Ruby, Python, C#, Java and TypeScript; in Rails,
          Django, .NET and NestJS; and in every version of Angular from
          AngularJS to 20, plus React and Vue. That range is what makes me
          effective with AI coding agents. I can tell when generated code is
          wrong in any layer, and I know which constraints to write down so that
          it isn’t.
        </p>
        <p>
          I live in Meadow Creek, in the Kootenays of British Columbia, and work
          remotely. Outside of work I am the volunteer developer for our
          <a routerLink="/work/lvcc">community centre</a> and I build the
          <a routerLink="/work/tempestas">control system</a> for my own
          greenhouse.
        </p>
      </div>
    </section>

    <section class="section wrap" aria-labelledby="ai">
      <h2 id="ai">How I work with AI</h2>
      <div class="grid">
        <div>
          <h3>Agents get a map</h3>
          <p class="muted">
            Every repo has an <code>AGENTS.md</code> that routes each kind of
            change to the doc that governs it, with the patterns to follow and
            the pitfalls that have already bitten.
          </p>
        </div>
        <div>
          <h3>Guardrails are mechanical</h3>
          <p class="muted">
            Typed contracts shared between front and back end, lint rules that
            enforce the architecture, and one gate — lint, tests and production
            builds — before anything is called done.
          </p>
        </div>
        <div>
          <h3>Review is not optional</h3>
          <p class="muted">
            An agent’s output is my output. I read it, test it and own it. At
            Sign In Solutions I helped bring that approach to projects, docs and
            developer environments across the organization.
          </p>
        </div>
      </div>
    </section>

    <section id="skills" class="section wrap" aria-labelledby="skills-title">
      <h2 id="skills-title">Skills</h2>
      <wf-skill-matrix />
    </section>
  `,
  styles: `
    code {
      font-family: var(--font-mono);
      font-size: 0.9em;
    }
  `,
})
export class About {
  constructor() {
    inject(SeoService).set({
      title: 'About',
      description:
        'Twenty years of full-stack work, from Palm and BlackBerry to Angular, NestJS and AWS — and how Greg Underwood uses AI coding agents with discipline.',
      path: '/about',
      type: 'profile',
      jsonLd: personJsonLd(),
    });
  }
}
