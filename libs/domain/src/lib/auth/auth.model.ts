/** Readable by the page, unlike the session cookies. It only says a session may exist and grants nothing. */
export const SIGNED_IN_HINT_COOKIE = 'wf_signed_in';

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
