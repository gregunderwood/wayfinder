import {
  type AdminProject,
  ApiErrorCode,
  type CreateProjectPayload,
  PROJECT_TAGLINE_MAX_LENGTH,
  ProjectKind,
  ProjectStatus,
} from '@wayfinder/domain';
import {
  cookieValues,
  type HttpMethod,
  useTestApp,
} from '../../testing/test-app';
import { useTestDatabase } from '../../testing/test-database';
import { TEST_DATA_ENCRYPTION_KEY } from '../../testing/test-secrets';
import { AdminAccountsService } from '../auth/admin-accounts.service';
import { AdminUserEntity } from '../auth/models';
import { SystemClock } from '../common/clock';
import { DataCipher } from '../common/data-cipher';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct horse battery staple';
const SOME_ID = '7d3c1f9e-8a52-4b7e-9c11-2f6a0d4e5b83';

const NEW_PROJECT: CreateProjectPayload = {
  slug: 'tempestas',
  name: 'Tempestas',
  tagline: 'A greenhouse controller.',
  kind: ProjectKind.Personal,
  role: 'Sole developer',
  period: '2026 – present',
  stack: ['NestJS', 'MQTT'],
  bodyMarkdown: 'Runs a greenhouse.',
  liveUrl: 'https://example.com',
  featured: true,
  sortOrder: 0,
  status: ProjectStatus.Published,
};

describe('projects API', () => {
  const database = useTestDatabase();
  const { send } = useTestApp(database);
  let adminCookies: Record<string, string>;

  // The access token is a signed cookie, so it outlives the per-test truncation of admin_users.
  beforeAll(async () => {
    await new AdminAccountsService(
      database.dataSource.getRepository(AdminUserEntity),
      new DataCipher(TEST_DATA_ENCRYPTION_KEY),
      new SystemClock(),
    ).createAdmin(EMAIL, PASSWORD);
    const signedIn = await send('POST', '/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
    });
    adminCookies = cookieValues(signedIn.setCookies);
  });

  async function createProject(
    overrides: Partial<CreateProjectPayload> = {},
  ): Promise<AdminProject> {
    const response = await send('POST', '/admin/projects', {
      cookies: adminCookies,
      body: { ...NEW_PROJECT, ...overrides },
    });
    expect(response.status).toBe(201);
    return response.body as AdminProject;
  }

  it.each<[HttpMethod, string]>([
    ['GET', '/admin/projects'],
    ['GET', `/admin/projects/${SOME_ID}`],
    ['GET', '/admin/projects/by-slug/tempestas'],
    ['POST', '/admin/projects'],
    ['PATCH', `/admin/projects/${SOME_ID}`],
    ['DELETE', `/admin/projects/${SOME_ID}`],
  ])('refuses %s %s without a session', async (method, path) => {
    const isRead = method === 'GET';
    const response = await send(method, path, {
      body: isRead ? undefined : NEW_PROJECT,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual(
      expect.objectContaining({ code: ApiErrorCode.Unauthorized }),
    );
  });

  it('publishes a created project to visitors', async () => {
    const created = await createProject();

    expect(created).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        status: ProjectStatus.Published,
        publishedAt: expect.any(String),
      }),
    );
    const listed = await send('GET', '/projects');
    expect(listed.body).toEqual([
      expect.objectContaining({ slug: 'tempestas' }),
    ]);
    const shown = await send('GET', '/projects/tempestas');
    expect(shown.status).toBe(200);
    expect(shown.body).not.toHaveProperty('id');
    expect(shown.body).not.toHaveProperty('status');
  });

  it('keeps a draft away from visitors but shows it to the admin', async () => {
    await createProject({ status: ProjectStatus.Draft });

    expect((await send('GET', '/projects')).body).toEqual([]);
    expect((await send('GET', '/projects/tempestas')).status).toBe(404);
    const adminList = await send('GET', '/admin/projects', {
      cookies: adminCookies,
    });
    expect(adminList.body).toEqual([
      expect.objectContaining({ status: ProjectStatus.Draft }),
    ]);
  });

  it('finds a project by its slug for the admin, and answers 404 for an unknown one', async () => {
    const { id } = await createProject();

    const found = await send('GET', '/admin/projects/by-slug/tempestas', {
      cookies: adminCookies,
    });
    const missing = await send('GET', '/admin/projects/by-slug/nope', {
      cookies: adminCookies,
    });

    expect(found.body).toEqual(expect.objectContaining({ id }));
    expect(missing.status).toBe(404);
  });

  it('shows the admin one project by its id', async () => {
    const { id } = await createProject({ status: ProjectStatus.Draft });

    const response = await send('GET', `/admin/projects/${id}`, {
      cookies: adminCookies,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ id, slug: 'tempestas' }),
    );
  });

  it.each([
    [
      'a tagline too long for a meta description',
      { tagline: 'x'.repeat(PROJECT_TAGLINE_MAX_LENGTH + 1) },
    ],
    ['a slug that is not a URL segment', { slug: 'Not A Slug' }],
    ['a script URL', { liveUrl: 'javascript:alert(1)' }],
    ['a field the contract does not have', { id: SOME_ID }],
    ['a missing name', { name: undefined }],
  ])('rejects a project with %s', async (_case, overrides) => {
    const response = await send('POST', '/admin/projects', {
      cookies: adminCookies,
      body: { ...NEW_PROJECT, ...overrides },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({ code: ApiErrorCode.ValidationFailed }),
    );
  });

  it('rejects an update that would blank a required field', async () => {
    const { id } = await createProject();

    const response = await send('PATCH', `/admin/projects/${id}`, {
      cookies: adminCookies,
      body: { name: null },
    });

    expect(response.status).toBe(400);
  });

  it('answers a taken slug with SlugTaken', async () => {
    await createProject();

    const response = await send('POST', '/admin/projects', {
      cookies: adminCookies,
      body: NEW_PROJECT,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({ code: ApiErrorCode.SlugTaken }),
    );
  });

  it('updates a project and returns it', async () => {
    const { id } = await createProject();

    const response = await send('PATCH', `/admin/projects/${id}`, {
      cookies: adminCookies,
      body: { featured: false, liveUrl: null },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ id, featured: false }),
    );
    expect(response.body).not.toHaveProperty('liveUrl');
  });

  it('deletes a project, after which visitors get a 404', async () => {
    const { id } = await createProject();

    const deleted = await send('DELETE', `/admin/projects/${id}`, {
      cookies: adminCookies,
    });

    expect(deleted.status).toBe(204);
    expect((await send('GET', '/projects/tempestas')).status).toBe(404);
  });

  it('rejects an id that is not a UUID before touching the database', async () => {
    const response = await send('DELETE', '/admin/projects/not-a-uuid', {
      cookies: adminCookies,
    });

    expect(response.status).toBe(400);
  });

  it('refuses an admin write that is not JSON', async () => {
    const response = await send('POST', '/admin/projects', {
      cookies: adminCookies,
      contentType: 'application/x-www-form-urlencoded',
      body: 'slug=tempestas',
    });

    expect(response.status).toBe(415);
  });
});
