import {
  HttpClient,
  HttpContext,
  HttpContextToken,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  AdminProfile,
  AdminProject,
  CreateProjectPayload,
  LoginPayload,
  Project,
  ProjectSummary,
  UpdateProjectPayload,
} from '@wayfinder/domain';
import { firstValueFrom, type Observable } from 'rxjs';

export const API_PATH = '/api';
// The API refuses any write that is not JSON, and HttpClient only sets the type when there is a body.
const EMPTY_JSON_BODY = {};

/** False for a call whose caller handles being signed out itself, such as the route guard. */
export const REDIRECT_TO_SIGN_IN = new HttpContextToken<boolean>(() => true);

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  listProjects(): Promise<ProjectSummary[]> {
    return this.send(this.http.get<ProjectSummary[]>(`${API_PATH}/projects`));
  }

  project(slug: string): Promise<Project> {
    return this.send(
      this.http.get<Project>(
        `${API_PATH}/projects/${encodeURIComponent(slug)}`,
      ),
    );
  }

  signIn(credentials: LoginPayload): Promise<void> {
    return this.send(
      this.http.post<void>(`${API_PATH}/auth/login`, credentials),
    );
  }

  refreshSession(): Promise<void> {
    return this.send(
      this.http.post<void>(`${API_PATH}/auth/refresh`, EMPTY_JSON_BODY),
    );
  }

  signOut(): Promise<void> {
    return this.send(
      this.http.post<void>(`${API_PATH}/auth/logout`, EMPTY_JSON_BODY),
    );
  }

  currentAdmin(): Promise<AdminProfile> {
    return this.send(
      this.http.get<AdminProfile>(`${API_PATH}/auth/me`, {
        context: new HttpContext().set(REDIRECT_TO_SIGN_IN, false),
      }),
    );
  }

  listAdminProjects(): Promise<AdminProject[]> {
    return this.send(
      this.http.get<AdminProject[]>(`${API_PATH}/admin/projects`),
    );
  }

  adminProject(id: string): Promise<AdminProject> {
    return this.send(
      this.http.get<AdminProject>(`${API_PATH}/admin/projects/${id}`),
    );
  }

  /** For a public page's edit link, which should vanish rather than redirect when signed out. */
  adminProjectBySlug(slug: string): Promise<AdminProject> {
    return this.send(
      this.http.get<AdminProject>(
        `${API_PATH}/admin/projects/by-slug/${encodeURIComponent(slug)}`,
        { context: new HttpContext().set(REDIRECT_TO_SIGN_IN, false) },
      ),
    );
  }

  createProject(payload: CreateProjectPayload): Promise<AdminProject> {
    return this.send(
      this.http.post<AdminProject>(`${API_PATH}/admin/projects`, payload),
    );
  }

  updateProject(
    id: string,
    payload: UpdateProjectPayload,
  ): Promise<AdminProject> {
    return this.send(
      this.http.patch<AdminProject>(
        `${API_PATH}/admin/projects/${id}`,
        payload,
      ),
    );
  }

  deleteProject(id: string): Promise<void> {
    return this.send(
      this.http.delete<void>(`${API_PATH}/admin/projects/${id}`, {
        body: EMPTY_JSON_BODY,
      }),
    );
  }

  private send<Response>(request: Observable<Response>): Promise<Response> {
    return firstValueFrom(request);
  }
}
