import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'work',
    loadComponent: () =>
      import('./features/work/work-list').then((m) => m.WorkList),
  },
  {
    path: 'work/:slug',
    loadComponent: () =>
      import('./features/work/work-detail').then((m) => m.WorkDetail),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about').then((m) => m.About),
  },
  {
    path: 'resume',
    loadComponent: () =>
      import('./features/resume/resume').then((m) => m.Resume),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
