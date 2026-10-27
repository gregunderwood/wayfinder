import type { Project } from '@wayfinder/domain';
import { PERSON, SITE_URL, absoluteUrl } from './site.config';

/** schema.org Person, referenced by id from every other block so crawlers join them. */
export function personJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/#person`,
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

export function projectJsonLd(project: Project): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.name,
    description: project.tagline,
    url: absoluteUrl(`/work/${project.slug}`),
    creator: { '@id': `${SITE_URL}/#person` },
    keywords: project.stack.join(', '),
    ...(project.liveUrl ? { sameAs: project.liveUrl } : {}),
  };
}
