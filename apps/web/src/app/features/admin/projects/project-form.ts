import {
  type FormControl,
  type FormGroup,
  type NonNullableFormBuilder,
  Validators,
} from '@angular/forms';
import {
  type AdminProject,
  type CreateProjectPayload,
  PROJECT_SLUG_PATTERN,
  PROJECT_TAGLINE_MAX_LENGTH,
  ProjectKind,
  ProjectStatus,
} from '@wayfinder/domain';

const STACK_SEPARATOR = ',';

export interface ProjectForm {
  slug: FormControl<string>;
  name: FormControl<string>;
  tagline: FormControl<string>;
  kind: FormControl<ProjectKind>;
  role: FormControl<string>;
  period: FormControl<string>;
  stack: FormControl<string>;
  bodyMarkdown: FormControl<string>;
  liveUrl: FormControl<string>;
  repoUrl: FormControl<string>;
  docsUrl: FormControl<string>;
  featured: FormControl<boolean>;
  sortOrder: FormControl<number>;
  status: FormControl<ProjectStatus>;
}

export type ProjectFormValue = ReturnType<
  FormGroup<ProjectForm>['getRawValue']
>;

export function buildProjectForm(
  builder: NonNullableFormBuilder,
): FormGroup<ProjectForm> {
  return builder.group({
    slug: ['', [Validators.required, Validators.pattern(PROJECT_SLUG_PATTERN)]],
    name: ['', Validators.required],
    tagline: [
      '',
      [Validators.required, Validators.maxLength(PROJECT_TAGLINE_MAX_LENGTH)],
    ],
    kind: [ProjectKind.Personal],
    role: ['', Validators.required],
    period: ['', Validators.required],
    stack: [''],
    bodyMarkdown: [''],
    liveUrl: [''],
    repoUrl: [''],
    docsUrl: [''],
    featured: [false],
    sortOrder: [0, [Validators.required, Validators.min(0)]],
    status: [ProjectStatus.Draft],
  });
}

export function toFormValue(project: AdminProject): ProjectFormValue {
  return {
    slug: project.slug,
    name: project.name,
    tagline: project.tagline,
    kind: project.kind,
    role: project.role,
    period: project.period,
    stack: project.stack.join(`${STACK_SEPARATOR} `),
    bodyMarkdown: project.bodyMarkdown,
    liveUrl: project.liveUrl ?? '',
    repoUrl: project.repoUrl ?? '',
    docsUrl: project.docsUrl ?? '',
    featured: project.featured,
    sortOrder: project.sortOrder,
    status: project.status,
  };
}

export function toPayload(value: ProjectFormValue): CreateProjectPayload {
  return {
    slug: value.slug.trim(),
    name: value.name.trim(),
    tagline: value.tagline.trim(),
    kind: value.kind,
    role: value.role.trim(),
    period: value.period.trim(),
    stack: value.stack
      .split(STACK_SEPARATOR)
      .map((technology) => technology.trim())
      .filter((technology) => technology.length > 0),
    bodyMarkdown: value.bodyMarkdown,
    liveUrl: linkOrNull(value.liveUrl),
    repoUrl: linkOrNull(value.repoUrl),
    docsUrl: linkOrNull(value.docsUrl),
    featured: value.featured,
    sortOrder: value.sortOrder,
    status: value.status,
  };
}

function linkOrNull(link: string): string | null {
  const trimmed = link.trim();
  return trimmed.length > 0 ? trimmed : null;
}
