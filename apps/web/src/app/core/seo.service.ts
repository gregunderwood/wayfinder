import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_NAME, absoluteUrl } from './site.config';

export interface PageSeo {
  /** Page name only; the site name is appended. Omit on the home page. */
  title?: string;
  description: string;
  /** Site-relative, e.g. `/work`. */
  path: string;
  type?: 'website' | 'profile' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

const JSON_LD_ID = 'wf-json-ld';

// Every tag is rewritten on each call: client-side navigation reuses the document.
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  set(page: PageSeo): void {
    const fullTitle = page.title ? `${page.title} · ${SITE_NAME}` : SITE_NAME;
    const canonicalUrl = absoluteUrl(page.path);

    this.setTitleAndIndexing(page, fullTitle);
    this.setSocialTags(page, fullTitle, canonicalUrl);
    this.setCanonicalLink(canonicalUrl);
    this.setJsonLd(page.jsonLd);
  }

  private setTitleAndIndexing(page: PageSeo, fullTitle: string): void {
    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({
      name: 'robots',
      content: page.noindex ? 'noindex, nofollow' : 'index, follow',
    });
  }

  private setSocialTags(
    page: PageSeo,
    fullTitle: string,
    canonicalUrl: string,
  ): void {
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({
      property: 'og:description',
      content: page.description,
    });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({
      property: 'og:type',
      content: page.type ?? 'website',
    });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
  }

  private setCanonicalLink(canonicalUrl: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalUrl);
  }

  private setJsonLd(jsonLd: PageSeo['jsonLd']): void {
    this.document.getElementById(JSON_LD_ID)?.remove();
    if (!jsonLd) return;
    const script = this.document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // Escaping `<` stops a "</script>" in content from closing the tag early.
    script.textContent = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }
}
