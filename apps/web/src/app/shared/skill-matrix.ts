import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SKILLS, groupSkills } from '../content/skills';

@Component({
  selector: 'wf-skill-matrix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="matrix">
      @for (group of groups; track group.category) {
        <section [attr.aria-labelledby]="'skills-' + group.category">
          <h3 [id]="'skills-' + group.category">{{ group.label }}</h3>
          <ul class="chips">
            @for (skill of group.skills; track skill.name) {
              <li class="chip" [class.featured]="skill.featured">
                {{ skill.name }}
                @if (skill.featured) {
                  <span class="visually-hidden">(daily use)</span>
                }
              </li>
            }
          </ul>
        </section>
      }
    </div>
    <p class="muted note">Highlighted: what I use day to day.</p>
  `,
  styles: `
    .matrix {
      display: grid;
      gap: var(--space-4) var(--space-5);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    }
    h3 {
      font-family: var(--font-body);
      font-size: 0.95rem;
      font-weight: 600;
      margin-bottom: var(--space-2);
    }
    .featured {
      background: var(--accent);
      color: var(--on-accent);
    }
    .note {
      font-size: 0.9rem;
      margin-top: var(--space-4);
    }
  `,
})
export class SkillMatrix {
  protected readonly groups = groupSkills(SKILLS);
}
