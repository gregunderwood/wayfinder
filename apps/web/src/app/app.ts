import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PERSON } from './core/site.config';

@Component({
  selector: 'wf-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="site-header no-print">
      <div class="wrap bar">
        <a class="brand" routerLink="/">{{ person.name }}</a>
        <nav aria-label="Primary">
          <ul>
            @for (link of links; track link.path) {
              <li>
                <a
                  [routerLink]="link.path"
                  routerLinkActive="active"
                  ariaCurrentWhenActive="page"
                  >{{ link.label }}</a
                >
              </li>
            }
            <li><a [href]="'mailto:' + person.email">Contact</a></li>
          </ul>
        </nav>
      </div>
    </header>

    <main id="main" tabindex="-1">
      <router-outlet />
    </main>

    <footer class="site-footer no-print">
      <div class="wrap">
        <p>
          © {{ year }} {{ person.name }} · {{ person.locality }},
          {{ person.region }} ·
          <a [href]="'mailto:' + person.email">{{ person.email }}</a>
        </p>
      </div>
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    main {
      flex: 1;
      outline: none;
    }
    .skip-link {
      position: absolute;
      left: var(--space-3);
      top: -4rem;
      z-index: 10;
      padding: var(--space-2) var(--space-3);
      background: var(--accent);
      color: var(--on-accent);
      border-radius: var(--radius);
    }
    .skip-link:focus {
      top: var(--space-3);
    }
    .site-header {
      border-bottom: 1px solid var(--border);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2) var(--space-4);
      padding-block: var(--space-3);
    }
    .brand {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text);
      text-decoration: none;
    }
    nav ul {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-4);
      list-style: none;
      margin: 0;
      padding: 0;
    }
    nav a {
      color: var(--muted);
      text-decoration: none;
      font-weight: 500;
      padding-block: var(--space-1);
      border-bottom: 2px solid transparent;
    }
    nav a:hover,
    nav a.active {
      color: var(--text);
      border-bottom-color: var(--accent);
    }
    .site-footer {
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.9rem;
      padding-block: var(--space-4);
    }
    .site-footer p {
      margin: 0;
    }
  `,
})
export class App {
  protected readonly person = PERSON;
  protected readonly year = new Date().getFullYear();
  protected readonly links = [
    { path: '/work', label: 'Work' },
    { path: '/about', label: 'About' },
    { path: '/resume', label: 'Résumé' },
  ];
}
