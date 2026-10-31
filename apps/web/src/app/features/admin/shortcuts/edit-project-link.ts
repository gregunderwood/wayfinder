import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import { ADMIN_HOME_PATH } from '../../../core/auth/admin-paths';

@Component({
  selector: 'wf-edit-project-link',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editorPath(); as path) {
      <a class="btn" [routerLink]="path">Edit this project</a>
    }
  `,
})
export class EditProjectLink {
  readonly slug = input.required<string>();

  private readonly api = inject(ApiService);
  protected readonly editorPath = signal<string[] | null>(null);

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => void this.findEditor(slug));
    });
  }

  // A project the database does not have yet simply has no link.
  private async findEditor(slug: string): Promise<void> {
    this.editorPath.set(null);
    const path = await this.api.adminProjectBySlug(slug).then(
      (project) => [ADMIN_HOME_PATH, project.id],
      () => null,
    );
    if (this.slug() === slug) {
      this.editorPath.set(path);
    }
  }
}
