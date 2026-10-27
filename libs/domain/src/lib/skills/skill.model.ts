export enum SkillCategory {
  Language = 'language',
  Frontend = 'frontend',
  Backend = 'backend',
  Data = 'data',
  Infra = 'infra',
  Mobile = 'mobile',
  Ai = 'ai',
}

export interface Skill {
  name: string;
  category: SkillCategory;
  /** Current, daily-use tools. Shown first and on the home page. */
  featured: boolean;
}
