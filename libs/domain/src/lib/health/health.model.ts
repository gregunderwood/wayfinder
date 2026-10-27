export interface HealthStatus {
  status: 'ok' | 'degraded';
  /** False when Postgres is unreachable; the public site can still serve prerendered pages. */
  db: boolean;
}
