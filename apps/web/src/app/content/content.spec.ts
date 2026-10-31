import { SkillCategory } from '@wayfinder/domain';
import { EARLIER_ROLES, ROLES } from './experience';
import { SKILLS, groupSkills } from './skills';

describe('content', () => {
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
