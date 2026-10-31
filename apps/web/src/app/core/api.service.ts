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
  UpdateProjectPayload,
} from '@wayfinder/domain';
import { firstValueFrom, type Observable } from 'rxjs';

const API = '/api';
// The API refuses any write that is not JSON, and HttpClient only sets the type when there is a body.
const EMPTY_JSON_BODY = {};

/** False for a call whose caller handles being signed out itself, such as the route guard. */
export const REDIRECT_TO_SIGN_IN = new HttpContextToken<boolean>(() => true);

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  signIn(credentials: LoginPayload): Promise<void> {
    return this.send(this.http.post<void>(`${API}/auth/login`, credentials));
  }

  refreshSession(): Promise<void> {
    return this.send(
      this.http.post<void>(`${API}/auth/refresh`, EMPTY_JSON_BODY),
    );
  }

  signOut(): Promise<void> {
    return this.send(
      this.http.post<void>(`${API}/auth/logout`, EMPTY_JSON_BODY),
    );
  }

  currentAdmin(): Promise<AdminProfile> {
    return this.send(
      this.http.get<AdminProfile>(`${API}/auth/me`, {
        context: new HttpContext().set(REDIRECT_TO_SIGN_IN, false),
      }),
    );
  }

  listAdminProjects(): Promise<AdminProject[]> {
    return this.send(this.http.get<AdminProject[]>(`${API}/admin/projects`));
  }

  adminProject(id: string): Promise<AdminProject> {
    return this.send(
      this.http.get<AdminProject>(`${API}/admin/projects/${id}`),
    );
  }

  createProject(payload: CreateProjectPayload): Promise<AdminProject> {
    return this.send(
      this.http.post<AdminProject>(`${API}/admin/projects`, payload),
    );
  }

  updateProject(
    id: string,
    payload: UpdateProjectPayload,
  ): Promise<AdminProject> {
    return this.send(
      this.http.patch<AdminProject>(`${API}/admin/projects/${id}`, payload),
    );
  }

  deleteProject(id: string): Promise<void> {
    return this.send(
      this.http.delete<void>(`${API}/admin/projects/${id}`, {
        body: EMPTY_JSON_BODY,
      }),
    );
  }

  private send<Response>(request: Observable<Response>): Promise<Response> {
    return firstValueFrom(request);
  }
}
