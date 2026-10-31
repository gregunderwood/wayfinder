import type { Routes } from '@angular/router';
import { AdminShell } from './admin-shell';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      {
        path: 'projects',
        loadComponent: () =>
          import('./projects/project-list').then(
            (module) => module.ProjectList,
          ),
      },
      {
        path: 'projects/new',
        loadComponent: () =>
          import('./projects/project-editor').then(
            (module) => module.ProjectEditor,
          ),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./projects/project-editor').then(
            (module) => module.ProjectEditor,
          ),
      },
    ],
  },
];
