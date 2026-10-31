import { Route } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import {
  featuredProjectsResolver,
  projectListResolver,
  projectPageResolver,
} from './features/work/project-resolvers';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    resolve: { featuredProjects: featuredProjectsResolver },
    loadComponent: () =>
      import('./features/home/home').then((module) => module.Home),
  },
  {
    path: 'work',
    resolve: { page: projectListResolver },
    loadComponent: () =>
      import('./features/work/work-list').then((module) => module.WorkList),
  },
  {
    path: 'work/:slug',
    resolve: { page: projectPageResolver },
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
