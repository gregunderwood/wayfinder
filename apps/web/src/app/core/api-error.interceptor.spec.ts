import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { type AdminProject, ApiErrorCode } from '@wayfinder/domain';
import { apiErrorInterceptor } from './api-error.interceptor';
import { ApiRequestError } from './api-request-error';
import { ApiService } from './api.service';
import { SIGN_IN_PATH } from './auth/admin-paths';
import { AdminSession } from './auth/admin-session';

const PROJECTS_URL = '/api/admin/projects';
const REFRESH_URL = '/api/auth/refresh';
const SIGNED_OUT = { code: ApiErrorCode.Unauthorized, message: 'Sign in' };

describe('apiErrorInterceptor', () => {
  let api: ApiService;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    api = TestBed.inject(ApiService);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  // The interceptor waits on promises between requests; let them settle before asserting.
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

  function answerWith(
    request: TestRequest,
    status: number,
    body: unknown,
  ): void {
    request.flush(body, { status, statusText: 'test' });
  }

  async function expectFailure(
    pending: Promise<unknown>,
  ): Promise<ApiRequestError> {
    const failure = await pending.then(
      () => {
        throw new Error('expected the request to fail');
      },
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(ApiRequestError);
    return failure as ApiRequestError;
  }

  it('hands components a typed ApiError with the validation messages', async () => {
    const pending = api.createProject({} as never);

    answerWith(backend.expectOne(PROJECTS_URL), 400, {
      code: ApiErrorCode.ValidationFailed,
      message: 'Validation failed',
      details: { errors: ['slug must match', 'name should not be empty'] },
    });

    const failure = await expectFailure(pending);
    expect(failure.status).toBe(400);
    expect(failure.is(ApiErrorCode.ValidationFailed)).toBe(true);
    expect(failure.validationErrors).toEqual([
      'slug must match',
      'name should not be empty',
    ]);
  });

  it('describes a server that cannot be reached', async () => {
    const pending = api.listAdminProjects();

    backend.expectOne(PROJECTS_URL).error(new ProgressEvent('error'));

    const failure = await expectFailure(pending);
    expect(failure.status).toBe(0);
    expect(failure.message).toBe('The server could not be reached');
  });

  it('refreshes an expired session once and retries the request', async () => {
    const pending = api.listAdminProjects();

    answerWith(backend.expectOne(PROJECTS_URL), 401, SIGNED_OUT);
    await settle();
    backend.expectOne(REFRESH_URL).flush(null, { status: 204, statusText: '' });
    await settle();
    const projects: AdminProject[] = [];
    backend.expectOne(PROJECTS_URL).flush(projects);

    expect(await pending).toEqual([]);
  });

  it('shares one refresh between requests that expire together', async () => {
    const first = api.listAdminProjects();
    const second = api.listAdminProjects();

    for (const request of backend.match(PROJECTS_URL)) {
      answerWith(request, 401, SIGNED_OUT);
    }
    await settle();
    backend.expectOne(REFRESH_URL).flush(null, { status: 204, statusText: '' });
    await settle();
    for (const request of backend.match(PROJECTS_URL)) {
      request.flush([]);
    }

    expect(await Promise.all([first, second])).toEqual([[], []]);
  });

  it('sends the admin to sign in, with a way back, when the session cannot be refreshed', async () => {
    const pending = api.listAdminProjects();

    answerWith(backend.expectOne(PROJECTS_URL), 401, SIGNED_OUT);
    await settle();
    answerWith(backend.expectOne(REFRESH_URL), 401, SIGNED_OUT);

    const failure = await expectFailure(pending);
    expect(failure.is(ApiErrorCode.Unauthorized)).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith([SIGN_IN_PATH], {
      queryParams: { returnUrl: router.url },
    });
  });

  it('forgets the signed-in admin when the session cannot be refreshed, so the guard checks again', async () => {
    const session = TestBed.inject(AdminSession);
    const loading = session.loadAdmin();
    backend.expectOne('/api/auth/me').flush({
      id: 'abc',
      email: 'owner@example.com',
      lastLoginAt: null,
    });
    await loading;
    const pending = api.listAdminProjects();

    answerWith(backend.expectOne(PROJECTS_URL), 401, SIGNED_OUT);
    await settle();
    answerWith(backend.expectOne(REFRESH_URL), 401, SIGNED_OUT);

    await expectFailure(pending);
    expect(session.admin()).toBeNull();
  });

  it('leaves the redirect to a caller that handles being signed out', async () => {
    const pending = api.currentAdmin();

    answerWith(backend.expectOne('/api/auth/me'), 401, SIGNED_OUT);
    await settle();
    answerWith(backend.expectOne(REFRESH_URL), 401, SIGNED_OUT);

    await expectFailure(pending);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not refresh again when the retried request is refused too', async () => {
    const pending = api.listAdminProjects();

    answerWith(backend.expectOne(PROJECTS_URL), 401, SIGNED_OUT);
    await settle();
    backend.expectOne(REFRESH_URL).flush(null, { status: 204, statusText: '' });
    await settle();
    answerWith(backend.expectOne(PROJECTS_URL), 401, SIGNED_OUT);

    const failure = await expectFailure(pending);
    expect(failure.is(ApiErrorCode.Unauthorized)).toBe(true);
    backend.expectNone(REFRESH_URL);
  });

  it('passes other failures straight through, without a refresh', async () => {
    const pending = api.signIn({ email: 'a@example.com', password: 'wrong' });

    answerWith(backend.expectOne('/api/auth/login'), 401, {
      code: ApiErrorCode.InvalidCredentials,
      message: 'Wrong',
    });

    const failure = await expectFailure(pending);
    expect(failure.is(ApiErrorCode.InvalidCredentials)).toBe(true);
    backend.expectNone(REFRESH_URL);
  });
});
