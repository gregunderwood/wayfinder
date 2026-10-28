import { DOCUMENT, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let seo: SeoService;
  let pageDocument: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    seo = TestBed.inject(SeoService);
    pageDocument = TestBed.inject(DOCUMENT);
  });

  const readMetaContent = (selector: string): string | null =>
    pageDocument.head
      .querySelector(`meta[${selector}]`)
      ?.getAttribute('content') ?? null;

  it('appends the site name to page titles but not to the home page', () => {
    seo.set({ title: 'Work', description: 'd', path: '/work' });
    expect(pageDocument.title).toBe('Work · Greg Underwood');
    seo.set({ description: 'd', path: '/' });
    expect(pageDocument.title).toBe('Greg Underwood');
  });

  it('points canonical and og:url at the production origin', () => {
    seo.set({ title: 'About', description: 'd', path: '/about' });
    const canonical = pageDocument.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe(
      'https://underwoodstyles.ca/about',
    );
    expect(readMetaContent('property="og:url"')).toBe(
      'https://underwoodstyles.ca/about',
    );
  });

  it('replaces, rather than accumulates, canonical links and JSON-LD', () => {
    seo.set({ description: 'a', path: '/a', jsonLd: { name: 'a' } });
    seo.set({ description: 'b', path: '/b', jsonLd: { name: 'b' } });
    expect(
      pageDocument.head.querySelectorAll('link[rel="canonical"]'),
    ).toHaveLength(1);
    const jsonLdScripts = pageDocument.head.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(jsonLdScripts).toHaveLength(1);
    expect(jsonLdScripts[0].textContent).toContain('"b"');
  });

  it('removes JSON-LD when the next page has none', () => {
    seo.set({ description: 'a', path: '/a', jsonLd: { name: 'a' } });
    seo.set({ description: 'b', path: '/b' });
    expect(
      pageDocument.head.querySelector('script[type="application/ld+json"]'),
    ).toBeNull();
  });

  it('cannot be broken out of by a closing script tag in content', () => {
    seo.set({ description: 'x', path: '/x', jsonLd: { name: '</script><b>' } });
    const jsonLdScript = pageDocument.head.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(jsonLdScript?.textContent).not.toContain('</script>');
    expect(JSON.parse(jsonLdScript?.textContent ?? '{}').name).toBe(
      '</script><b>',
    );
  });

  it('marks noindex pages and restores indexing on the next page', () => {
    seo.set({ description: 'x', path: '/x', noindex: true });
    expect(readMetaContent('name="robots"')).toBe('noindex, nofollow');
    seo.set({ description: 'y', path: '/y' });
    expect(readMetaContent('name="robots"')).toBe('index, follow');
  });
});
