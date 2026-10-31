import { DOCUMENT, Injectable, inject } from '@angular/core';
import { ApiService } from '../api.service';

export const REFRESH_LOCK = 'wayfinder-session-refresh';

// Requests that fail together share one refresh: the refresh token rotates on use, so a second
// concurrent refresh would present a revoked token and sign the admin out.
@Injectable({ providedIn: 'root' })
export class SessionRefresher {
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private refreshInFlight: Promise<void> | null = null;

  refresh(): Promise<void> {
    this.refreshInFlight ??= this.oneTabAtATime(() =>
      this.api.refreshSession(),
    ).finally(() => (this.refreshInFlight = null));
    return this.refreshInFlight;
  }

  // Other tabs share the cookies but not this promise. Taking turns under a lock means each
  // refresh presents the token the previous one issued.
  private async oneTabAtATime(refresh: () => Promise<void>): Promise<void> {
    const locks = this.document.defaultView?.navigator.locks;
    if (!locks) {
      return refresh();
    }
    await locks.request(REFRESH_LOCK, refresh);
  }
}
