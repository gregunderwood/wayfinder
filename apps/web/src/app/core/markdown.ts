import { marked } from 'marked';

/**
 * Markdown to an HTML string, synchronously so it renders during prerender.
 * The output is bound with [innerHTML], which runs it through Angular's
 * sanitizer; that matters once posts come from the CMS rather than this repo.
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown.trim(), { async: false, gfm: true });
}
