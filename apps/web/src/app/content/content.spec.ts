import {
  PROJECT_SLUG_PATTERN,
  PROJECT_TAGLINE_MAX_LENGTH,
  SkillCategory,
} from '@wayfinder/domain';
import { EARLIER_ROLES, ROLES } from './experience';
import { PROJECTS, findProject, projectsInOrder } from './projects';
import { SKILLS, groupSkills } from './skills';

describe('content', () => {
  it('has unique project slugs that are safe URL segments', () => {
    const slugs = PROJECTS.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(PROJECT_SLUG_PATTERN);
  });

  it('keeps taglines short enough to serve as meta descriptions', () => {
    for (const project of PROJECTS) {
      expect(project.tagline.length, project.slug).toBeLessThanOrEqual(
        PROJECT_TAGLINE_MAX_LENGTH,
      );
    }
  });

  it('orders projects by sortOrder and finds them by slug', () => {
    const sortOrders = projectsInOrder().map((project) => project.sortOrder);
    expect(sortOrders).toEqual(
      [...sortOrders].sort((first, second) => first - second),
    );
    expect(findProject('lvcc')?.name).toContain('Lardeau');
    expect(findProject('missing')).toBeUndefined();
  });

  it('puts featured skills first within each group and drops empty groups', () => {
    const groups = groupSkills(SKILLS);
    for (const group of groups) {
      const firstUnfeaturedIndex = group.skills.findIndex(
        (skill) => !skill.featured,
      );
      const lastFeaturedIndex = group.skills
        .map((skill) => skill.featured)
        .lastIndexOf(true);
      if (firstUnfeaturedIndex !== -1) {
        expect(lastFeaturedIndex).toBeLessThan(firstUnfeaturedIndex);
      }
    }
    const onlyAi = groupSkills([
      { name: 'x', category: SkillCategory.Ai, featured: false },
    ]);
    expect(onlyAi.map((group) => group.category)).toEqual([SkillCategory.Ai]);
  });

  it('gives every role at least one highlight', () => {
    for (const role of ROLES) expect(role.highlights.length).toBeGreaterThan(0);
    expect(EARLIER_ROLES.length).toBeGreaterThan(0);
  });
});
