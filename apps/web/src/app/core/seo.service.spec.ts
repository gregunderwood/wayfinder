import { DOCUMENT, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let seo: SeoService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    seo = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
  });

  const meta = (selector: string): string | null =>
    doc.head.querySelector(`meta[${selector}]`)?.getAttribute('content') ??
    null;

  it('appends the site name to page titles but not to the home page', () => {
    seo.set({ title: 'Work', description: 'd', path: '/work' });
    expect(doc.title).toBe('Work · Greg Underwood');
    seo.set({ description: 'd', path: '/' });
    expect(doc.title).toBe('Greg Underwood');
  });

  it('points canonical and og:url at the production origin', () => {
    seo.set({ title: 'About', description: 'd', path: '/about' });
    const canonical = doc.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe(
      'https://underwoodstyles.ca/about',
    );
    expect(meta('property="og:url"')).toBe('https://underwoodstyles.ca/about');
  });

  // A client-side navigation reuses the document: leftovers from the previous
  // page would describe the wrong page to anything that reads the live DOM.
  it('replaces, rather than accumulates, canonical links and JSON-LD', () => {
    seo.set({ description: 'a', path: '/a', jsonLd: { name: 'a' } });
    seo.set({ description: 'b', path: '/b', jsonLd: { name: 'b' } });
    expect(doc.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    const blocks = doc.head.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].textContent).toContain('"b"');
  });

  it('removes JSON-LD when the next page has none', () => {
    seo.set({ description: 'a', path: '/a', jsonLd: { name: 'a' } });
    seo.set({ description: 'b', path: '/b' });
    expect(
      doc.head.querySelector('script[type="application/ld+json"]'),
    ).toBeNull();
  });

  it('cannot be broken out of by a closing script tag in content', () => {
    seo.set({ description: 'x', path: '/x', jsonLd: { name: '</script><b>' } });
    const block = doc.head.querySelector('script[type="application/ld+json"]');
    expect(block?.textContent).not.toContain('</script>');
    expect(JSON.parse(block?.textContent ?? '{}').name).toBe('</script><b>');
  });

  it('marks noindex pages and restores indexing on the next page', () => {
    seo.set({ description: 'x', path: '/x', noindex: true });
    expect(meta('name="robots"')).toBe('noindex, nofollow');
    seo.set({ description: 'y', path: '/y' });
    expect(meta('name="robots"')).toBe('index, follow');
  });
});
