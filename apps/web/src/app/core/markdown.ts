import { marked } from 'marked';

export function renderMarkdown(markdown: string): string {
  // Without async: false marked returns a Promise, which prerender would not wait for.
  return marked.parse(markdown.trim(), { async: false, gfm: true });
}
