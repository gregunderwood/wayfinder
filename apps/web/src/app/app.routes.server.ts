import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Pages showing projects render per request, so an edit is live without a deploy.
  { path: '', renderMode: RenderMode.Server },
  { path: 'work', renderMode: RenderMode.Server },
  { path: 'work/:slug', renderMode: RenderMode.Server },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'resume', renderMode: RenderMode.Prerender },
  // Signed-in pages: never prerendered, and nothing for a crawler to render.
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  // Per request, because a prerendered page can only be served with a 200.
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
