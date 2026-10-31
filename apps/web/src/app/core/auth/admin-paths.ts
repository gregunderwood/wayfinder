export const SIGN_IN_PATH = '/admin/login';
export const ADMIN_HOME_PATH = '/admin/projects';

// Only a path inside the admin is followed after sign-in, so a crafted link cannot bounce the
// admin to another site ("//evil.example") or back to the sign-in page.
export function safeReturnUrl(returnUrl: string | null | undefined): string {
  const isAdminPath =
    !!returnUrl &&
    /^\/admin(\/|$|\?)/.test(returnUrl) &&
    !returnUrl.startsWith(SIGN_IN_PATH);
  return isAdminPath ? returnUrl : ADMIN_HOME_PATH;
}
