import type { PageSeo } from '../../core/seo.service';

export function adminPageSeo(title: string, path: string): PageSeo {
  return {
    title,
    description: 'Site administration.',
    path,
    noindex: true,
  };
}
