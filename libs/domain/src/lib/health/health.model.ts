export interface HealthStatus {
  status: 'ok' | 'degraded';
  databaseReachable: boolean;
}
