export const SITE_URL = 'https://underwoodstyles.ca';

export const SITE_NAME = 'Greg Underwood';

export const PERSON = {
  name: 'Greg Underwood',
  jobTitle: 'Full-Stack Software Engineer',
  email: 'greg.underwood.bc@gmail.com',
  /** Town only. The street address and phone numbers stay off the public site. */
  locality: 'Meadow Creek',
  region: 'BC',
  country: 'CA',
} as const;

export const AVAILABILITY = 'Open to remote full-time and contract work';

export function absoluteUrl(path: string): string {
  const rootedPath = path.startsWith('/') ? path : `/${path}`;
  return rootedPath === '/' ? `${SITE_URL}/` : `${SITE_URL}${rootedPath}`;
}
