import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import {
  type AdminProfile,
  ApiErrorCode,
  type LoginPayload,
  SIGNED_IN_HINT_COOKIE,
} from '@wayfinder/domain';
import { ApiService } from '../api.service';
import { toApiRequestError } from '../api-request-error';

@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private readonly signedInAdmin = signal<AdminProfile | null>(null);
  private adminLoading: Promise<AdminProfile | null> | null = null;

  readonly admin = this.signedInAdmin.asReadonly();

  // The guard and the public pages' check can both ask on a cold load; they share one request.
  loadAdmin(): Promise<AdminProfile | null> {
    if (this.signedInAdmin()) {
      return Promise.resolve(this.signedInAdmin());
    }
    this.adminLoading ??= this.fetchAdmin().finally(
      () => (this.adminLoading = null),
    );
    return this.adminLoading;
  }

  // Without the hint, every visitor would make a failing /me and a failing refresh.
  async restore(): Promise<void> {
    if (this.hasSignedInHint()) {
      await this.loadAdmin().catch(() => null);
    }
  }

  private async fetchAdmin(): Promise<AdminProfile | null> {
    try {
      this.signedInAdmin.set(await this.api.currentAdmin());
    } catch (error) {
      if (!toApiRequestError(error).is(ApiErrorCode.Unauthorized)) {
        throw error;
      }
    }
    return this.signedInAdmin();
  }

  async signIn(credentials: LoginPayload): Promise<void> {
    await this.api.signIn(credentials);
    this.signedInAdmin.set(await this.api.currentAdmin());
  }

  async signOut(): Promise<void> {
    await this.api.signOut();
    this.forget();
  }

  /** For when the server has already ended the session, such as a refused refresh. */
  forget(): void {
    this.signedInAdmin.set(null);
  }

  private hasSignedInHint(): boolean {
    return this.document.cookie
      .split('; ')
      .some((cookie) => cookie.startsWith(`${SIGNED_IN_HINT_COOKIE}=`));
  }
}
