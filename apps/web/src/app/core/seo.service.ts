import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_NAME, absoluteUrl } from './site.config';

export interface PageSeo {
  /** Page name only; the site name is appended. Omit on the home page. */
  title?: string;
  description: string;
  /** Site-relative path; becomes the canonical and og:url. */
  path: string;
  type?: 'website' | 'profile' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** For pages that must never be indexed: 404s, and later /admin. */
  noindex?: boolean;
}

const JSON_LD_ID = 'wf-json-ld';

/**
 * The only writer of <head> metadata. Every page calls `set` once with
 * everything it needs; anything not passed is reset rather than left over from
 * the previous route, because a client-side navigation reuses the same
 * document and a stale canonical or JSON-LD block would describe the wrong page.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  set(page: PageSeo): void {
    const fullTitle = page.title ? `${page.title} · ${SITE_NAME}` : SITE_NAME;
    const url = absoluteUrl(page.path);

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({
      name: 'robots',
      content: page.noindex ? 'noindex, nofollow' : 'index, follow',
    });

    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({
      property: 'og:description',
      content: page.description,
    });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({
      property: 'og:type',
      content: page.type ?? 'website',
    });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });

    this.setCanonical(url);
    this.setJsonLd(page.jsonLd);
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: PageSeo['jsonLd']): void {
    this.document.getElementById(JSON_LD_ID)?.remove();
    if (!data) return;
    const script = this.document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // `<` is escaped so a string containing "</script>" cannot close the tag
    // early and turn content into markup.
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }
}
