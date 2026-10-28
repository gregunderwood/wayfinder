import type { Project } from '@wayfinder/domain';
import { PERSON, SITE_URL, absoluteUrl } from './site.config';

const PERSON_ID = `${SITE_URL}/#person`;

export function buildPersonJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: PERSON.name,
    jobTitle: PERSON.jobTitle,
    email: `mailto:${PERSON.email}`,
    url: `${SITE_URL}/`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: PERSON.locality,
      addressRegion: PERSON.region,
      addressCountry: PERSON.country,
    },
  };
}

export function buildProjectJsonLd(project: Project): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.name,
    description: project.tagline,
    url: absoluteUrl(`/work/${project.slug}`),
    creator: { '@id': PERSON_ID },
    keywords: project.stack.join(', '),
    ...(project.liveUrl ? { sameAs: project.liveUrl } : {}),
  };
}
