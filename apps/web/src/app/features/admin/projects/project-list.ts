import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { type AdminProject, ProjectStatus } from '@wayfinder/domain';
import { ApiService } from '../../../core/api.service';
import { toApiRequestError } from '../../../core/api-request-error';
import { ADMIN_HOME_PATH } from '../../../core/auth/admin-paths';
import { SeoService } from '../../../core/seo.service';
import { adminPageSeo } from '../admin-page';

@Component({
  selector: 'wf-project-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap page-head">
      <div class="heading-row">
        <h1>Projects</h1>
        <a class="btn btn-primary" routerLink="/admin/projects/new"
          >New project</a
        >
      </div>
      @if (failure(); as failure) {
        <p class="form-error" role="alert">{{ failure }}</p>
      } @else if (projects(); as projects) {
        @if (projects.length === 0) {
          <p class="muted">No projects yet.</p>
        } @else {
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Status</th>
                <th scope="col">Order</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              @for (project of projects; track project.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/admin/projects', project.id]">{{
                      project.name
                    }}</a>
                    <span class="muted slug">/work/{{ project.slug }}</span>
                  </td>
                  <td>
                    <span
                      class="status"
                      [class.is-draft]="project.status === draft"
                      >{{ project.status }}</span
                    >
                    @if (project.featured) {
                      <span class="muted"> · featured</span>
                    }
                  </td>
                  <td>{{ project.sortOrder }}</td>
                  <td>
                    <time [attr.datetime]="project.updatedAt">{{
                      project.updatedAt.slice(0, 10)
                    }}</time>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      } @else {
        <p class="muted" aria-live="polite">Loading…</p>
      }
    </section>
  `,
  styles: `
    .slug {
      display: block;
      font-size: 0.85rem;
    }
  `,
})
export class ProjectList {
  private readonly api = inject(ApiService);

  protected readonly projects = signal<AdminProject[] | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly draft = ProjectStatus.Draft;

  constructor() {
    inject(SeoService).set(adminPageSeo('Projects', ADMIN_HOME_PATH));
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.projects.set(await this.api.listAdminProjects());
    } catch (error) {
      this.failure.set(toApiRequestError(error).message);
    }
  }
}
