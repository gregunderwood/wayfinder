import {
  ApiErrorCode,
  type CreateProjectPayload,
  ProjectKind,
  ProjectStatus,
} from '@wayfinder/domain';
import type { EntityManager } from 'typeorm';
import { useTestDatabase } from '../../testing/test-database';
import { FixedClock } from '../common/clock';
import { ProjectEntity } from './models';
import { ProjectsService } from './projects.service';

const NOW = new Date('2026-11-02T09:00:00Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MISSING_ID = '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83';
const LOCK_WAIT_DEADLINE_MS = 5_000;
const LOCK_POLL_INTERVAL_MS = 10;

function aProject(
  overrides: Partial<CreateProjectPayload> = {},
): CreateProjectPayload {
  return {
    slug: 'tempestas',
    name: 'Tempestas',
    tagline: 'A greenhouse controller.',
    kind: ProjectKind.Personal,
    role: 'Sole developer',
    period: '2026 – present',
    stack: ['NestJS', 'MQTT'],
    bodyMarkdown: 'Runs a greenhouse.',
    featured: false,
    sortOrder: 0,
    status: ProjectStatus.Published,
    ...overrides,
  };
}

async function expectApiError(
  pending: Promise<unknown>,
  status: number,
  code: ApiErrorCode,
): Promise<void> {
  await expect(pending).rejects.toSatisfy(
    (error: { getStatus(): number; getResponse(): { code: ApiErrorCode } }) =>
      error.getStatus() === status && error.getResponse().code === code,
  );
}

describe('ProjectsService', () => {
  const database = useTestDatabase();
  let clock: FixedClock;
  let projects: ProjectsService;

  beforeEach(() => {
    clock = new FixedClock(NOW);
    projects = new ProjectsService(
      database.dataSource.getRepository(ProjectEntity),
      clock,
    );
  });

  // Holds the rival's write uncommitted until the contested call is blocked behind its lock.
  async function afterRivalCommits<Result>(
    rivalWrite: (rival: EntityManager) => Promise<unknown>,
    contested: () => Promise<Result>,
  ): Promise<Result> {
    const rival = database.dataSource.createQueryRunner();
    await rival.connect();
    try {
      await rival.startTransaction();
      await rivalWrite(rival.manager);
      const outcome = contested();
      outcome.catch(() => undefined);
      await waitUntilAQueryIsBlockedOnALock();
      await rival.commitTransaction();
      return await outcome;
    } finally {
      if (rival.isTransactionActive) {
        await rival.rollbackTransaction();
      }
      await rival.release();
    }
  }

  async function waitUntilAQueryIsBlockedOnALock(): Promise<void> {
    const deadline = Date.now() + LOCK_WAIT_DEADLINE_MS;
    while (Date.now() < deadline) {
      const [{ blocked }] = await database.dataSource.query<
        { blocked: number }[]
      >(
        "SELECT count(*)::int AS blocked FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
      );
      if (blocked > 0) {
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, LOCK_POLL_INTERVAL_MS),
      );
    }
    throw new Error('The contested call never waited on the rival’s lock');
  }

  describe('the public read', () => {
    it('lists only published projects, in sort order', async () => {
      await projects.create(aProject({ slug: 'second', sortOrder: 2 }));
      await projects.create(aProject({ slug: 'first', sortOrder: 1 }));
      await projects.create(
        aProject({ slug: 'unfinished', status: ProjectStatus.Draft }),
      );

      const listed = await projects.listPublished();

      expect(listed.map((project) => project.slug)).toEqual([
        'first',
        'second',
      ]);
    });

    it('shows nothing a visitor should not see', async () => {
      await projects.create(aProject({ liveUrl: 'https://example.com' }));

      const project = await projects.findPublished('tempestas');

      expect(Object.keys(project).sort()).toEqual(
        [
          'bodyMarkdown',
          'featured',
          'kind',
          'liveUrl',
          'name',
          'period',
          'role',
          'slug',
          'sortOrder',
          'stack',
          'tagline',
        ].sort(),
      );
    });

    it('answers a draft and a missing slug with the same 404', async () => {
      await projects.create(aProject({ status: ProjectStatus.Draft }));

      await expectApiError(
        projects.findPublished('tempestas'),
        404,
        ApiErrorCode.NotFound,
      );
      await expectApiError(
        projects.findPublished('never-existed'),
        404,
        ApiErrorCode.NotFound,
      );
    });
  });

  describe('creating', () => {
    it('stamps the publish time only on a published project', async () => {
      const published = await projects.create(aProject());
      const draft = await projects.create(
        aProject({ slug: 'draft', status: ProjectStatus.Draft }),
      );

      expect(published.publishedAt).toBe(NOW.toISOString());
      expect(draft.publishedAt).toBeNull();
    });

    it('stores a missing link as no link', async () => {
      const created = await projects.create(
        aProject({ repoUrl: 'https://github.com/example/tempestas' }),
      );

      expect(created).not.toHaveProperty('liveUrl');
      expect(created.repoUrl).toBe('https://github.com/example/tempestas');
    });

    it('refuses a slug that is already taken', async () => {
      await projects.create(aProject());

      await expectApiError(
        projects.create(aProject({ status: ProjectStatus.Draft })),
        409,
        ApiErrorCode.SlugTaken,
      );
    });

    it('relies on the unique index when two writes race for a slug', async () => {
      await expectApiError(
        afterRivalCommits(
          (rival) =>
            rival.insert(ProjectEntity, { ...aProject(), publishedAt: NOW }),
          () => projects.create(aProject()),
        ),
        409,
        ApiErrorCode.SlugTaken,
      );
    });
  });

  describe('updating', () => {
    it('changes only the fields it is given, and removes a link set to null', async () => {
      const { id } = await projects.create(
        aProject({ liveUrl: 'https://example.com' }),
      );

      const updated = await projects.update(id, {
        tagline: 'A safer greenhouse controller.',
        liveUrl: null,
      });

      expect(updated.tagline).toBe('A safer greenhouse controller.');
      expect(updated.name).toBe('Tempestas');
      expect(updated.stack).toEqual(['NestJS', 'MQTT']);
      expect(updated).not.toHaveProperty('liveUrl');
    });

    it('keeps the first publish time through unpublishing and publishing again', async () => {
      const { id } = await projects.create(
        aProject({ status: ProjectStatus.Draft }),
      );

      await projects.update(id, { status: ProjectStatus.Published });
      clock.advanceBy(ONE_DAY_MS);
      await projects.update(id, { status: ProjectStatus.Draft });
      const republished = await projects.update(id, {
        status: ProjectStatus.Published,
      });

      expect(republished.publishedAt).toBe(NOW.toISOString());
    });

    it('refuses to rename a published project, whose slug is a public URL', async () => {
      const { id } = await projects.create(aProject());

      await expectApiError(
        projects.update(id, { slug: 'renamed' }),
        400,
        ApiErrorCode.SlugLocked,
      );
      await expectApiError(
        projects.update(id, {
          slug: 'renamed',
          status: ProjectStatus.Draft,
        }),
        400,
        ApiErrorCode.SlugLocked,
      );
    });

    it('renames a draft, and accepts a published project’s own slug', async () => {
      const draft = await projects.create(
        aProject({ slug: 'draft', status: ProjectStatus.Draft }),
      );
      const published = await projects.create(aProject());

      expect((await projects.update(draft.id, { slug: 'renamed' })).slug).toBe(
        'renamed',
      );
      expect(
        (await projects.update(published.id, { slug: 'tempestas' })).slug,
      ).toBe('tempestas');
    });

    it('refuses to rename a draft onto a taken slug', async () => {
      await projects.create(aProject());
      const draft = await projects.create(
        aProject({ slug: 'draft', status: ProjectStatus.Draft }),
      );

      await expectApiError(
        projects.update(draft.id, { slug: 'tempestas' }),
        409,
        ApiErrorCode.SlugTaken,
      );
    });

    it('answers 404 when the project is deleted after it was read, rather than recreating it', async () => {
      const { id } = await projects.create(aProject());
      const repository = database.dataSource.getRepository(ProjectEntity);
      const readProject = repository.findOneBy.bind(repository);
      vi.spyOn(repository, 'findOneBy').mockImplementationOnce(
        async (where) => {
          const project = await readProject(where);
          await repository.delete({ id });
          return project;
        },
      );

      await expectApiError(
        projects.update(id, { name: 'Edited' }),
        404,
        ApiErrorCode.NotFound,
      );
      expect(await projects.listAll()).toEqual([]);
    });

    it('answers an unknown id with a 404', async () => {
      await expectApiError(
        projects.update(MISSING_ID, { name: 'Ghost' }),
        404,
        ApiErrorCode.NotFound,
      );
    });
  });

  describe('deleting', () => {
    it('removes the project from the admin list', async () => {
      const { id } = await projects.create(aProject());

      await projects.remove(id);

      expect(await projects.listAll()).toEqual([]);
    });

    it('answers an unknown id with a 404', async () => {
      await expectApiError(
        projects.remove(MISSING_ID),
        404,
        ApiErrorCode.NotFound,
      );
    });
  });

  describe('reading one for the admin', () => {
    it('finds a draft by its id', async () => {
      const { id } = await projects.create(
        aProject({ status: ProjectStatus.Draft }),
      );

      expect(await projects.findById(id)).toEqual(
        expect.objectContaining({ id, status: ProjectStatus.Draft }),
      );
    });

    it('finds a draft by its slug', async () => {
      const { id } = await projects.create(
        aProject({ status: ProjectStatus.Draft }),
      );

      expect(await projects.findBySlug('tempestas')).toEqual(
        expect.objectContaining({ id }),
      );
    });

    it('answers an unknown slug with a 404', async () => {
      await expectApiError(
        projects.findBySlug('nope'),
        404,
        ApiErrorCode.NotFound,
      );
    });

    it('answers an unknown id with a 404', async () => {
      await expectApiError(
        projects.findById(MISSING_ID),
        404,
        ApiErrorCode.NotFound,
      );
    });
  });

  it('lists drafts and published projects alike for the admin', async () => {
    await projects.create(aProject({ status: ProjectStatus.Draft }));
    await projects.create(aProject({ slug: 'other', sortOrder: 1 }));

    expect(await projects.listAll()).toEqual([
      expect.objectContaining({
        slug: 'tempestas',
        status: ProjectStatus.Draft,
        id: expect.any(String),
        createdAt: expect.any(String),
      }),
      expect.objectContaining({
        slug: 'other',
        status: ProjectStatus.Published,
      }),
    ]);
  });
});
