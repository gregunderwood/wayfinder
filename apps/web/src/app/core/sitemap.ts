import { PROJECTS } from '../content/projects';
import { absoluteUrl } from './site.config';

/**
 * Every indexable path. Derived from the content rather than listed by hand,
 * so a new project cannot be published without also being in the sitemap.
 */
export function sitemapPaths(): string[] {
  return [
    '/',
    '/work',
    ...PROJECTS.map((project) => `/work/${project.slug}`),
    '/about',
    '/resume',
  ];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSitemap(paths: string[]): string {
  const urls = paths
    .map((path) => `  <url><loc>${escapeXml(absoluteUrl(path))}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
