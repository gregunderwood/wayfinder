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
  // Per request, because a prerendered page can only be served with a 200.
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
