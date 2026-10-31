import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { SIGN_IN_PATH } from '../../core/auth/admin-paths';
import { AdminSession } from '../../core/auth/admin-session';
import { SignOutButton } from './sign-out-button';

@Component({
  selector: 'wf-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SignOutButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-bar">
      <div class="wrap bar">
        <nav aria-label="Admin">
          <a
            routerLink="/admin/projects"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            >Projects</a
          >
        </nav>
        <p class="signed-in">
          @if (session.admin(); as admin) {
            <span class="muted">{{ admin.email }}</span>
          }
          <wf-sign-out-button (signedOut)="showSignIn()" />
        </p>
      </div>
    </div>
    <router-outlet />
  `,
  // Unencapsulated so the admin's shared form and table styles reach every routed admin page.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './admin.scss',
})
export class AdminShell {
  protected readonly session = inject(AdminSession);
  private readonly router = inject(Router);

  protected showSignIn(): void {
    void this.router.navigateByUrl(SIGN_IN_PATH);
  }
}
