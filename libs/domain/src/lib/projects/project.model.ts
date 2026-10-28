export enum ProjectKind {
  Employment = 'employment',
  Volunteer = 'volunteer',
  Personal = 'personal',
}

export interface Project {
  /** Unique; cannot change while published, or links break. */
  slug: string;
  name: string;
  /** Doubles as the meta description; at most 160 characters. */
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
