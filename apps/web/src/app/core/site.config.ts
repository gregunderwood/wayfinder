/**
 * The one place the site's identity and public origin live. Canonical URLs,
 * Open Graph tags, JSON-LD and the sitemap all derive from SITE_URL, so moving
 * hosts or domains is a change here and nowhere else.
 */
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

/** Absolute URL for a site path; tolerant of a missing leading slash. */
export function absoluteUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return normalised === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalised}`;
}
