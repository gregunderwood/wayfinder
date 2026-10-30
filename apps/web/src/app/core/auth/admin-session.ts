import { Injectable, inject, signal } from '@angular/core';
import {
  type AdminProfile,
  ApiErrorCode,
  type LoginPayload,
} from '@wayfinder/domain';
import { ApiService } from '../api.service';
import { toApiRequestError } from '../api-request-error';

@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly api = inject(ApiService);
  private readonly signedInAdmin = signal<AdminProfile | null>(null);

  readonly admin = this.signedInAdmin.asReadonly();

  async loadAdmin(): Promise<AdminProfile | null> {
    if (this.signedInAdmin()) {
      return this.signedInAdmin();
    }
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
}
