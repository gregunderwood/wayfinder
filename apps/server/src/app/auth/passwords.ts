import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';

export const MIN_PASSWORD_LENGTH = 12;

const OWASP_MINIMUM_ARGON2ID = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummyPasswordHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OWASP_MINIMUM_ARGON2ID);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}

// Verifying against this when there is no account keeps a wrong email as slow as a wrong password.
export function hashThatMatchesNoPassword(): Promise<string> {
  dummyPasswordHash ??= hashPassword(randomBytes(32).toString('hex'));
  return dummyPasswordHash;
}

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
