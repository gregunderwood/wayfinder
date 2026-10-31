import { buildSitemap, listSitemapPaths } from './sitemap';

describe('sitemap', () => {
  it('lists the static pages and a page for every published project', () => {
    expect(listSitemapPaths(['gateway', 'lvcc'])).toEqual([
      '/',
      '/work',
      '/work/gateway',
      '/work/lvcc',
      '/about',
      '/resume',
    ]);
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
