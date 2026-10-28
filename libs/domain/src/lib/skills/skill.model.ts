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
  /** Daily-use tools: listed first and shown on the home page. */
  featured: boolean;
}
