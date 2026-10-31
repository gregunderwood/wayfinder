import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ApiErrorCode } from '@wayfinder/domain';
import { toApiRequestError } from '../../core/api-request-error';
import { SIGN_IN_PATH, safeReturnUrl } from '../../core/auth/admin-paths';
import { AdminSession } from '../../core/auth/admin-session';
import { SeoService } from '../../core/seo.service';
import { adminPageSeo } from './admin-page';

const SIGN_IN_FAILURE_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  [ApiErrorCode.InvalidCredentials]: 'That email and password do not match.',
  [ApiErrorCode.RateLimited]:
    'Too many attempts. Wait a minute, then try again.',
};
const FALLBACK_FAILURE_MESSAGE = 'Signing in failed. Try again in a moment.';

@Component({
  selector: 'wf-admin-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap page-head sign-in">
      <h1>Sign in</h1>
      <form class="stack-form card" [formGroup]="form" (ngSubmit)="signIn()">
        @if (failure(); as failure) {
          <p class="form-error" role="alert">{{ failure }}</p>
        }
        <label class="field">
          <span>Email</span>
          <input type="email" formControlName="email" autocomplete="username" />
        </label>
        <label class="field">
          <span>Password</span>
          <input
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
        </label>
        <button
          type="submit"
          class="btn btn-primary"
          [disabled]="form.invalid || signingIn()"
        >
          {{ signingIn() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './admin.scss',
})
export class AdminLogin {
  /** Bound from the query string by withComponentInputBinding. */
  readonly returnUrl = input<string>();

  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly signingIn = signal(false);
  protected readonly failure = signal<string | null>(null);

  constructor() {
    inject(SeoService).set(adminPageSeo('Sign in', SIGN_IN_PATH));
  }

  protected async signIn(): Promise<void> {
    this.signingIn.set(true);
    this.failure.set(null);
    try {
      await this.session.signIn(this.form.getRawValue());
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
    } catch (error) {
      const { code } = toApiRequestError(error);
      this.failure.set(
        SIGN_IN_FAILURE_MESSAGES[code] ?? FALLBACK_FAILURE_MESSAGE,
      );
    } finally {
      this.signingIn.set(false);
    }
  }
}
