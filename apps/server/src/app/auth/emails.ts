import { createHash, timingSafeEqual } from 'node:crypto';

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSameEmail(storedEmail: string, givenEmail: string): boolean {
  return timingSafeEqual(
    digest(normaliseEmail(storedEmail)),
    digest(normaliseEmail(givenEmail)),
  );
}

function digest(email: string): Buffer {
  return createHash('sha256').update(email).digest();
}
