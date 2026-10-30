import {
  type AdminProject,
  ProjectKind,
  ProjectStatus,
} from '@wayfinder/domain';
import { toFormValue, toPayload } from './project-form';

const PROJECT: AdminProject = {
  id: '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83',
  slug: 'tempestas',
  name: 'Tempestas',
  tagline: 'A greenhouse controller.',
  kind: ProjectKind.Personal,
  role: 'Sole developer',
  period: '2026 – present',
  stack: ['NestJS', 'MQTT', 'Raspberry Pi'],
  bodyMarkdown: 'Runs a greenhouse.',
  repoUrl: 'https://github.com/example/tempestas',
  featured: true,
  sortOrder: 2,
  status: ProjectStatus.Published,
  publishedAt: '2026-11-02T09:00:00.000Z',
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-02T09:00:00.000Z',
};

describe('the project form', () => {
  it('turns a saved project back into the same payload', () => {
    expect(toPayload(toFormValue(PROJECT))).toEqual({
      slug: 'tempestas',
      name: 'Tempestas',
      tagline: 'A greenhouse controller.',
      kind: ProjectKind.Personal,
      role: 'Sole developer',
      period: '2026 – present',
      stack: ['NestJS', 'MQTT', 'Raspberry Pi'],
      bodyMarkdown: 'Runs a greenhouse.',
      liveUrl: null,
      repoUrl: 'https://github.com/example/tempestas',
      docsUrl: null,
      featured: true,
      sortOrder: 2,
      status: ProjectStatus.Published,
    });
  });

  it('removes a link that was cleared, and tidies the stack and text', () => {
    const payload = toPayload({
      ...toFormValue(PROJECT),
      name: '  Tempestas  ',
      repoUrl: '   ',
      stack: ' NestJS ,, MQTT , ',
    });

    expect(payload.name).toBe('Tempestas');
    expect(payload.repoUrl).toBeNull();
    expect(payload.stack).toEqual(['NestJS', 'MQTT']);
  });
});
