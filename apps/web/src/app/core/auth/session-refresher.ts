import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api.service';

// Requests that fail together share one refresh: the refresh token rotates on use, so a second
// concurrent refresh would present a revoked token and sign the admin out.
@Injectable({ providedIn: 'root' })
export class SessionRefresher {
  private readonly api = inject(ApiService);
  private refreshInFlight: Promise<void> | null = null;

  refresh(): Promise<void> {
    this.refreshInFlight ??= this.api
      .refreshSession()
      .finally(() => (this.refreshInFlight = null));
    return this.refreshInFlight;
  }
}
