import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ADMIN_HOME_PATH } from '../../../core/auth/admin-paths';
import { AdminSession } from '../../../core/auth/admin-session';
import { SignOutButton } from '../sign-out-button';

@Component({
  selector: 'wf-signed-in-bar',
  imports: [RouterLink, SignOutButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.admin(); as admin) {
      <aside class="signed-in-bar no-print" aria-label="Admin">
        <div class="wrap bar">
          <p>
            Signed in as <strong>{{ admin.email }}</strong>
          </p>
          <p class="actions">
            <a [routerLink]="adminHome">Admin</a>
            <wf-sign-out-button />
          </p>
        </div>
      </aside>
    }
  `,
  styles: `
    .signed-in-bar {
      background: var(--accent-soft);
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2) var(--space-4);
      padding-block: var(--space-2);
    }
    p {
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }
    a {
      font-weight: 600;
    }
  `,
})
export class SignedInBar {
  protected readonly session = inject(AdminSession);
  protected readonly adminHome = ADMIN_HOME_PATH;
}
