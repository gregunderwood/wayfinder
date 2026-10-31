import { ADMIN_HOME_PATH, isAdminPath, safeReturnUrl } from './admin-paths';

describe('safeReturnUrl', () => {
  it.each(['/admin/projects/7d3c1f9e', '/admin', '/admin?tab=drafts'])(
    'follows %s, which is inside the admin',
    (returnUrl) => {
      expect(safeReturnUrl(returnUrl)).toBe(returnUrl);
    },
  );

  it.each([
    ['nothing', undefined],
    ['another site', '//evil.example/admin'],
    ['an absolute URL', 'https://evil.example/admin'],
    ['a public page', '/work'],
    ['a path that only starts like the admin', '/administrator'],
    ['the sign-in page itself', '/admin/login?returnUrl=/admin'],
  ])('goes to the admin home instead of %s', (_case, returnUrl) => {
    expect(safeReturnUrl(returnUrl)).toBe(ADMIN_HOME_PATH);
  });
});

describe('isAdminPath', () => {
  it.each(['/admin', '/admin/projects', '/admin?x=1', '/admin#main'])(
    'counts %s as the admin',
    (url) => {
      expect(isAdminPath(url)).toBe(true);
    },
  );

  it.each(['', '/', '/work', '/administrator'])(
    'counts %s as public',
    (url) => {
      expect(isAdminPath(url)).toBe(false);
    },
  );
});
