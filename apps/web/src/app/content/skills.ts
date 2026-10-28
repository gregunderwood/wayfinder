import { SkillCategory, type Skill } from '@wayfinder/domain';

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  [SkillCategory.Ai]: 'AI-assisted delivery',
  [SkillCategory.Frontend]: 'Front end',
  [SkillCategory.Backend]: 'Back end & APIs',
  [SkillCategory.Infra]: 'Cloud & DevOps',
  [SkillCategory.Data]: 'Data',
  [SkillCategory.Language]: 'Languages',
  [SkillCategory.Mobile]: 'Mobile & devices',
};

export const SKILL_CATEGORY_ORDER: SkillCategory[] = [
  SkillCategory.Ai,
  SkillCategory.Frontend,
  SkillCategory.Backend,
  SkillCategory.Infra,
  SkillCategory.Data,
  SkillCategory.Language,
  SkillCategory.Mobile,
];

const skill = (
  name: string,
  category: SkillCategory,
  featured = false,
): Skill => ({ name, category, featured });

export const SKILLS: Skill[] = [
  skill('Claude Code & agent workflows', SkillCategory.Ai, true),
  skill('LLM integration (Claude API)', SkillCategory.Ai, true),
  skill('Speech-to-text pipelines', SkillCategory.Ai),
  skill('Agent-ready repos & docs', SkillCategory.Ai),

  skill('Angular', SkillCategory.Frontend, true),
  skill('TypeScript', SkillCategory.Frontend, true),
  skill('React', SkillCategory.Frontend),
  skill('Vue', SkillCategory.Frontend),
  skill('AngularJS migration', SkillCategory.Frontend),
  skill('SSR & SEO', SkillCategory.Frontend),
  skill('Accessible, responsive CSS', SkillCategory.Frontend),
  skill('Micro-frontends', SkillCategory.Frontend),

  skill('Node.js', SkillCategory.Backend, true),
  skill('NestJS', SkillCategory.Backend, true),
  skill('Ruby on Rails', SkillCategory.Backend),
  skill('Django', SkillCategory.Backend),
  skill('.NET MVC', SkillCategory.Backend),
  skill('REST API design', SkillCategory.Backend),
  skill('OAuth 2.0, SAML, JWT', SkillCategory.Backend, true),

  skill('AWS (Cognito, SNS, SQS)', SkillCategory.Infra, true),
  skill('Docker', SkillCategory.Infra, true),
  skill('Nx monorepos', SkillCategory.Infra),
  skill('CI pipelines', SkillCategory.Infra),
  skill('nginx & Linux', SkillCategory.Infra),
  skill('Queues: Redis, RabbitMQ, MQTT', SkillCategory.Infra),

  skill('PostgreSQL', SkillCategory.Data, true),
  skill('MySQL', SkillCategory.Data),
  skill('SQL Server', SkillCategory.Data),
  skill('Oracle', SkillCategory.Data),
  skill('TypeORM', SkillCategory.Data),

  skill('TypeScript / JavaScript', SkillCategory.Language),
  skill('Ruby', SkillCategory.Language),
  skill('Python', SkillCategory.Language),
  skill('C#', SkillCategory.Language),
  skill('Java', SkillCategory.Language),
  skill('SQL', SkillCategory.Language),
  skill('C / C++', SkillCategory.Language),
  skill('PHP', SkillCategory.Language),

  skill('Flutter', SkillCategory.Mobile),
  skill('iOS & Android', SkillCategory.Mobile),
  skill('BlackBerry, Palm, Pocket PC', SkillCategory.Mobile),
  skill('Raspberry Pi & IoT', SkillCategory.Mobile),
];

export interface SkillGroup {
  category: SkillCategory;
  label: string;
  skills: Skill[];
}

function featuredFirst(first: Skill, second: Skill): number {
  return Number(second.featured) - Number(first.featured);
}

export function groupSkills(skills: Skill[]): SkillGroup[] {
  return SKILL_CATEGORY_ORDER.map((category) => ({
    category,
    label: SKILL_CATEGORY_LABELS[category],
    skills: skills
      .filter((entry) => entry.category === category)
      .sort(featuredFirst),
  })).filter((group) => group.skills.length > 0);
}
