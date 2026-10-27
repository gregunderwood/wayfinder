/** Why the work exists, which changes how a reader weighs it. */
export enum ProjectKind {
  Employment = 'employment',
  Volunteer = 'volunteer',
  Personal = 'personal',
}

export interface Project {
  /** URL segment under /work; unique, and stable once published or links break. */
  slug: string;
  name: string;
  /** One sentence. Doubles as the meta description, so keep it under ~160 characters. */
  tagline: string;
  kind: ProjectKind;
  /** What Greg did, not the team's title: "Sole developer", "Lead developer". */
  role: string;
  /** Human-readable span, e.g. "2024 – present". */
  period: string;
  stack: string[];
  bodyMarkdown: string;
  liveUrl?: string;
  repoUrl?: string;
  featured: boolean;
  sortOrder: number;
}
