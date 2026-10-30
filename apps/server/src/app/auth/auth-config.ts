import type { EnvLookup } from '../../database';

const MIN_JWT_SECRET_LENGTH = 32;

export function readJwtSecret(env: EnvLookup): string {
  const jwtSecret = env('JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters; see .env.example`,
    );
  }
  return jwtSecret;
}
