export enum ProjectKind {
  Employment = 'employment',
  Volunteer = 'volunteer',
  Personal = 'personal',
}

export enum ProjectStatus {
  Draft = 'draft',
  Published = 'published',
}

export const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PROJECT_TAGLINE_MAX_LENGTH = 160;

export interface Project {
  /** Unique, and matches PROJECT_SLUG_PATTERN; cannot change while published, or links break. */
  slug: string;
  name: string;
  /** Doubles as the meta description; at most PROJECT_TAGLINE_MAX_LENGTH characters. */
  tagline: string;
  kind: ProjectKind;
  /** Greg's own role, not the team's: "Sole developer". */
  role: string;
  /** Display text, e.g. "2024 – present". */
  period: string;
  stack: string[];
  bodyMarkdown: string;
  liveUrl?: string;
  repoUrl?: string;
  /** Public docs, for work whose product sits behind a login. */
  docsUrl?: string;
  featured: boolean;
  sortOrder: number;
}

/** A project as listed: everything but the body, which only its own page needs. */
export type ProjectSummary = Omit<Project, 'bodyMarkdown'>;

export interface AdminProject extends Project {
  id: string;
  status: ProjectStatus;
  /** ISO-8601; set the first time the project is published, and kept after. */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type ProjectLinks = 'liveUrl' | 'repoUrl' | 'docsUrl';

export type CreateProjectPayload = Omit<Project, ProjectLinks> & {
  status: ProjectStatus;
  liveUrl?: string | null;
  repoUrl?: string | null;
  docsUrl?: string | null;
};

/** A missing field is left as it is; a link set to null is removed. */
export type UpdateProjectPayload = Partial<CreateProjectPayload>;
