export interface LoginPayload {
  email: string;
  password: string;
}

export interface AdminProfile {
  id: string;
  email: string;
  /** ISO-8601; null until the first sign-in. */
  lastLoginAt: string | null;
}
