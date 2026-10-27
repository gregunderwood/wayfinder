import { RenderMode, ServerRoute } from '@angular/ssr';
import { PROJECTS } from './content/projects';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'work', renderMode: RenderMode.Prerender },
  {
    path: 'work/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams(): Promise<Record<string, string>[]> {
      return PROJECTS.map((project) => ({ slug: project.slug }));
    },
  },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'resume', renderMode: RenderMode.Prerender },
  // Rendered per request so a mistyped URL gets a real 404, not a 200 that
  // search engines index as a duplicate "not found" page.
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
