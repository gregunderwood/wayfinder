import { PROJECTS } from '../content/projects';
import { buildSitemap, sitemapPaths } from './sitemap';

describe('sitemap', () => {
  it('lists every project page, so publishing one cannot skip the sitemap', () => {
    const paths = sitemapPaths();
    for (const project of PROJECTS) {
      expect(paths).toContain(`/work/${project.slug}`);
    }
  });

  it('emits absolute URLs on the production origin', () => {
    const xml = buildSitemap(['/', '/about']);
    expect(xml).toContain('<loc>https://underwoodstyles.ca/</loc>');
    expect(xml).toContain('<loc>https://underwoodstyles.ca/about</loc>');
  });

  it('escapes characters that would make the XML invalid', () => {
    expect(buildSitemap(['/a&b'])).toContain('/a&amp;b');
  });
});
