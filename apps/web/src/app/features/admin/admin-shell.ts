import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
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

@Component({
  selector: 'wf-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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
          <button type="button" class="btn btn-small" (click)="signOut()">
            Sign out
          </button>
        </p>
        @if (signOutFailed()) {
          <p class="field-error" role="alert">
            Signing out failed. Check the connection and try again.
          </p>
        }
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
  protected readonly signOutFailed = signal(false);

  protected async signOut(): Promise<void> {
    this.signOutFailed.set(false);
    try {
      await this.session.signOut();
    } catch {
      this.signOutFailed.set(true);
      return;
    }
    await this.router.navigateByUrl(SIGN_IN_PATH);
  }
}
