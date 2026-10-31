import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { AdminSession } from '../../core/auth/admin-session';

@Component({
  selector: 'wf-sign-out-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn" (click)="signOut()">Sign out</button>
    @if (failed()) {
      <span class="failure" role="alert">
        Signing out failed. Check the connection and try again.
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    button {
      padding: 0.3rem 0.75rem;
      font-size: 0.9rem;
    }
    .failure {
      color: var(--danger);
    }
  `,
})
export class SignOutButton {
  readonly signedOut = output<void>();

  private readonly session = inject(AdminSession);
  protected readonly failed = signal(false);

  protected async signOut(): Promise<void> {
    this.failed.set(false);
    try {
      await this.session.signOut();
    } catch {
      this.failed.set(true);
      return;
    }
    this.signedOut.emit();
  }
}
