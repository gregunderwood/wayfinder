import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { Project, ProjectSummary } from '@wayfinder/domain';
import { ApiService } from '../../core/api.service';
import { type PageData, loadContent, loadPageData } from '../../core/page-data';

export const projectListResolver: ResolveFn<PageData<ProjectSummary[]>> = (
  _route,
  state,
) => {
  const api = inject(ApiService);
  return loadPageData(state.url, () => api.listProjects());
};

export const projectPageResolver: ResolveFn<PageData<Project>> = (
  route,
  state,
) => {
  const api = inject(ApiService);
  return loadPageData(state.url, () =>
    api.project(route.paramMap.get('slug') ?? ''),
  );
};

// The home page is about more than projects, so an outage drops that section instead of the page.
export const featuredProjectsResolver: ResolveFn<ProjectSummary[]> = (
  _route,
  state,
) => {
  const api = inject(ApiService);
  return loadContent(state.url, () => api.listProjects()).then((page) =>
    page.status === 'ready'
      ? page.content.filter((project) => project.featured)
      : [],
  );
};
