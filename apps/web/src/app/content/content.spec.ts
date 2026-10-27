import { SkillCategory } from '@wayfinder/domain';
import { EARLIER_ROLES, ROLES } from './experience';
import { PROJECTS, findProject, projectsInOrder } from './projects';
import { SKILLS, groupSkills } from './skills';

// Hand-edited content with rules a typo can break silently: a duplicate slug
// shadows a page, and a long tagline is truncated in every search result.
describe('content', () => {
  it('has unique project slugs that are safe URL segments', () => {
    const slugs = PROJECTS.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('keeps taglines short enough to serve as meta descriptions', () => {
    for (const project of PROJECTS) {
      expect(project.tagline.length, project.slug).toBeLessThanOrEqual(160);
    }
  });

  it('orders projects by sortOrder and finds them by slug', () => {
    const orders = projectsInOrder().map((project) => project.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(findProject('lvcc')?.name).toContain('Lardeau');
    expect(findProject('missing')).toBeUndefined();
  });

  it('puts featured skills first within each group and drops empty groups', () => {
    const groups = groupSkills(SKILLS);
    for (const group of groups) {
      const firstPlain = group.skills.findIndex((skill) => !skill.featured);
      const lastFeatured = group.skills
        .map((s) => s.featured)
        .lastIndexOf(true);
      if (firstPlain !== -1) expect(lastFeatured).toBeLessThan(firstPlain);
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
