import { Route } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/home/home').then((module) => module.Home),
  },
  {
    path: 'work',
    loadComponent: () =>
      import('./features/work/work-list').then((module) => module.WorkList),
  },
  {
    path: 'work/:slug',
    loadComponent: () =>
      import('./features/work/work-detail').then((module) => module.WorkDetail),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./features/about/about').then((module) => module.About),
  },
  {
    path: 'resume',
    loadComponent: () =>
      import('./features/resume/resume').then((module) => module.Resume),
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./features/admin/login').then((module) => module.AdminLogin),
  },
  {
    path: 'admin',
    canMatch: [adminGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then(
        (module) => module.adminRoutes,
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found').then(
        (module) => module.NotFound,
      ),
  },
];
