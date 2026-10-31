import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { Project, ProjectSummary } from '@wayfinder/domain';
import { ApiService } from '../../core/api.service';
import { type PageData, loadPageData } from '../../core/page-data';

export const projectListResolver: ResolveFn<
  PageData<ProjectSummary[]>
> = () => {
  const api = inject(ApiService);
  return loadPageData(() => api.listProjects());
};

export const projectPageResolver: ResolveFn<PageData<Project>> = (route) => {
  const api = inject(ApiService);
  return loadPageData(() => api.project(route.paramMap.get('slug') ?? ''));
};

// The home page is about more than projects, so an outage drops that section instead of the page.
export const featuredProjectsResolver: ResolveFn<ProjectSummary[]> = () =>
  inject(ApiService)
    .listProjects()
    .then(
      (projects) => projects.filter((project) => project.featured),
      () => [],
    );
