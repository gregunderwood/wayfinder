import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Location } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { isAdminPath, SIGN_IN_PATH } from './core/auth/admin-paths';
import { AdminSession } from './core/auth/admin-session';
import { PERSON } from './core/site.config';
import { SignedInBar } from './features/admin/shortcuts/signed-in-bar';

@Component({
  selector: 'wf-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SignedInBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>

    @if (showsSignedInBar()) {
      @defer (on immediate) {
        <wf-signed-in-bar />
      }
    }

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
          @if (showsSignInLink()) {
            · <a [routerLink]="signInPath" rel="nofollow">Admin sign in</a>
          }
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
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    // The router's URL is "/" until its first navigation ends; the address bar is already right.
    { initialValue: inject(Location).path() },
  );
  private readonly isOnPublicPage = computed(() => !isAdminPath(this.url()));

  // The admin pages have their own bar, and the sign-in page needs no link to itself.
  protected readonly showsSignedInBar = computed(
    () => this.isOnPublicPage() && this.session.admin() !== null,
  );
  protected readonly showsSignInLink = computed(
    () => this.isOnPublicPage() && this.session.admin() === null,
  );
  protected readonly signInPath = SIGN_IN_PATH;
  protected readonly person = PERSON;
  protected readonly year = new Date().getFullYear();
  protected readonly links = [
    { path: '/work', label: 'Work' },
    { path: '/about', label: 'About' },
    { path: '/resume', label: 'Résumé' },
  ];

  constructor() {
    afterNextRender(() => void this.session.restore());
  }
}
