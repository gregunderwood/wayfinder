import { ProjectKind } from '@wayfinder/domain';

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  [ProjectKind.Employment]: 'Professional',
  [ProjectKind.Volunteer]: 'Volunteer',
  [ProjectKind.Personal]: 'Personal',
};
