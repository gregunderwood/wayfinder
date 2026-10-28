import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EDUCATION, EARLIER_ROLES, ROLES } from '../../content/experience';
import { SKILLS, groupSkills } from '../../content/skills';
import { SeoService } from '../../core/seo.service';
import { AVAILABILITY, PERSON, SITE_URL } from '../../core/site.config';
import { buildPersonJsonLd } from '../../core/structured-data';

@Component({
  selector: 'wf-resume',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="wrap resume">
      <header class="page-head">
        <div class="title-row">
          <h1>{{ person.name }}</h1>
          <button type="button" class="btn no-print" (click)="print()">
            Print or save as PDF
          </button>
        </div>
        <p class="role">{{ person.jobTitle }}</p>
        <p class="contact">
          <a [href]="'mailto:' + person.email">{{ person.email }}</a>
          <span aria-hidden="true">·</span>
          <span>{{ person.locality }}, {{ person.region }} · Remote</span>
          <span aria-hidden="true">·</span>
          <a [href]="siteUrl">{{ siteHost }}</a>
        </p>
        <p class="summary">
          Full-stack engineer with twenty years across web, mobile and cloud —
          Angular, Node/NestJS, Rails and AWS — who uses AI agent workflows to
          deliver at the pace of a team. {{ availability }}.
        </p>
      </header>

      <section class="section" aria-labelledby="exp">
        <h2 id="exp">Experience</h2>
        @for (role of roles; track role.company) {
          <section class="role-block">
            <div class="role-head">
              <h3>
                {{ role.title }} · {{ role.company }}
                @if (role.companyNote) {
                  <span class="note">({{ role.companyNote }})</span>
                }
              </h3>
              <p class="period">{{ role.period }} · {{ role.location }}</p>
            </div>
            <p>{{ role.summary }}</p>
            <ul>
              @for (highlight of role.highlights; track highlight) {
                <li>{{ highlight }}</li>
              }
            </ul>
          </section>
        }
      </section>

      <section class="section" aria-labelledby="earlier">
        <h2 id="earlier">Earlier work</h2>
        <ul class="earlier">
          @for (role of earlierRoles; track role.company) {
            <li>
              <strong>{{ role.company }}</strong>
              <span class="period">{{ role.period }}</span> — {{ role.line }}
            </li>
          }
        </ul>
      </section>

      <section class="section" aria-labelledby="skills">
        <h2 id="skills">Skills</h2>
        <dl class="skills">
          @for (group of skillGroups; track group.category) {
            <div>
              <dt>{{ group.label }}</dt>
              <dd>{{ joinSkillNames(group.skills) }}</dd>
            </div>
          }
        </dl>
      </section>

      <section class="section" aria-labelledby="edu">
        <h2 id="edu">Education</h2>
        <ul class="earlier">
          @for (entry of education; track entry.school) {
            <li>
              <strong>{{ entry.school }}</strong>
              <span class="period">{{ entry.period }}</span>
              @if (entry.credential) {
                — {{ entry.credential }}
              }
            </li>
          }
        </ul>
      </section>
    </article>
  `,
  styles: `
    .resume {
      max-width: 52rem;
    }
    .title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .title-row h1 {
      margin: 0;
    }
    .role {
      font-size: 1.15rem;
      margin: var(--space-2) 0;
    }
    .contact {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      color: var(--muted);
    }
    .summary {
      max-width: var(--measure);
    }
    .role-block + .role-block {
      margin-top: var(--space-5);
    }
    .role-head h3 {
      margin-bottom: var(--space-1);
    }
    .note,
    .period {
      color: var(--muted);
      font-weight: 400;
    }
    .period {
      font-size: 0.95rem;
    }
    ul {
      padding-left: 1.25rem;
    }
    li + li {
      margin-top: var(--space-2);
    }
    .earlier .period {
      margin-left: var(--space-2);
    }
    .skills div {
      display: grid;
      grid-template-columns: minmax(9rem, 12rem) 1fr;
      gap: var(--space-3);
      padding-block: var(--space-2);
    }
    dt {
      font-weight: 600;
    }
    dd {
      margin: 0;
    }
    @media (max-width: 36rem) {
      .skills div {
        grid-template-columns: 1fr;
        gap: 0;
      }
    }
    @media print {
      .page-head {
        padding-top: 0;
      }
      .role-block {
        break-inside: avoid;
      }
      .role-block + .role-block {
        margin-top: var(--space-4);
      }
    }
  `,
})
export class Resume {
  protected readonly person = PERSON;
  protected readonly availability = AVAILABILITY;
  protected readonly siteUrl = SITE_URL;
  protected readonly siteHost = new URL(SITE_URL).host;
  protected readonly roles = ROLES;
  protected readonly earlierRoles = EARLIER_ROLES;
  protected readonly education = EDUCATION;
  protected readonly skillGroups = groupSkills(SKILLS);

  constructor() {
    inject(SeoService).set({
      title: 'Résumé',
      description:
        'Résumé of Greg Underwood, full-stack software engineer: Sign In Solutions, BMC Software and twenty years across Angular, Node, Rails and AWS.',
      path: '/resume',
      type: 'profile',
      jsonLd: buildPersonJsonLd(),
    });
  }

  protected joinSkillNames(skills: { name: string }[]): string {
    return skills.map((skill) => skill.name).join(', ');
  }

  protected print(): void {
    // Safe without a platform check: clicks never happen during server rendering.
    window.print();
  }
}
