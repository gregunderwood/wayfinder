import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AdminProject,
  ApiErrorCode,
  type CreateProjectPayload,
  type Project,
  ProjectStatus,
  type UpdateProjectPayload,
} from '@wayfinder/domain';
import {
  type FindOptionsWhere,
  QueryFailedError,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { Clock } from '../common/clock';
import { ProjectEntity, SLUG_INDEX } from './models';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    private readonly clock: Clock,
  ) {}

  async listPublished(): Promise<Project[]> {
    const published = await this.inDisplayOrder(
      this.publishedQuery(),
    ).getMany();
    return published.map(toProject);
  }

  async findPublished(slug: string): Promise<Project> {
    const project = await this.publishedQuery()
      .andWhere('project.slug = :slug', { slug })
      .getOne();
    if (!project) {
      throw projectNotFound();
    }
    return toProject(project);
  }

  async listAll(): Promise<AdminProject[]> {
    const projects = await this.inDisplayOrder(
      this.projects.createQueryBuilder('project'),
    ).getMany();
    return projects.map(toAdminProject);
  }

  async findById(id: string): Promise<AdminProject> {
    return toAdminProject(await this.requireProject({ id }));
  }

  async findBySlug(slug: string): Promise<AdminProject> {
    return toAdminProject(await this.requireProject({ slug }));
  }

  async create(payload: CreateProjectPayload): Promise<AdminProject> {
    await this.requireSlugAvailable(payload.slug);
    const project = this.projects.create({
      ...payload,
      liveUrl: payload.liveUrl ?? null,
      repoUrl: payload.repoUrl ?? null,
      docsUrl: payload.docsUrl ?? null,
      publishedAt: this.publishedAtFor(payload.status, null),
    });
    const created = await this.claimingSlug(payload.slug, () =>
      this.projects.save(project),
    );
    return toAdminProject(created);
  }

  async update(
    id: string,
    payload: UpdateProjectPayload,
  ): Promise<AdminProject> {
    const project = await this.requireProject({ id });
    const changes = withoutUnchangedFields(payload);
    const slug = changes.slug ?? project.slug;
    if (slug !== project.slug) {
      requireRenameAllowed(project);
      await this.requireSlugAvailable(slug);
    }
    const publishedAt = this.publishedAtFor(
      changes.status ?? project.status,
      project.publishedAt,
    );
    // update(), not save(): save() re-inserts a row that was deleted after it was read.
    await this.claimingSlug(slug, () =>
      this.projects.update(id, { ...changes, publishedAt }),
    );
    return toAdminProject(await this.requireProject({ id }));
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.projects.delete({ id });
    if (!affected) {
      throw projectNotFound();
    }
  }

  private publishedQuery(): SelectQueryBuilder<ProjectEntity> {
    return this.projects
      .createQueryBuilder('project')
      .where('project.status = :status', { status: ProjectStatus.Published });
  }

  private inDisplayOrder(
    query: SelectQueryBuilder<ProjectEntity>,
  ): SelectQueryBuilder<ProjectEntity> {
    return query
      .orderBy('project.sortOrder', 'ASC')
      .addOrderBy('project.slug', 'ASC');
  }

  private async requireProject(
    where: FindOptionsWhere<ProjectEntity>,
  ): Promise<ProjectEntity> {
    const project = await this.projects.findOneBy(where);
    if (!project) {
      throw projectNotFound();
    }
    return project;
  }

  private async requireSlugAvailable(slug: string): Promise<void> {
    if (await this.projects.existsBy({ slug })) {
      throw slugTaken(slug);
    }
  }

  // The check before it is only for a clean message; the unique index is the guarantee.
  private async claimingSlug<Written>(
    slug: string,
    write: () => Promise<Written>,
  ): Promise<Written> {
    try {
      return await write();
    } catch (error) {
      if (isSlugTakenViolation(error)) {
        throw slugTaken(slug);
      }
      throw error;
    }
  }

  private publishedAtFor(
    status: ProjectStatus,
    firstPublishedAt: Date | null,
  ): Date | null {
    if (firstPublishedAt || status !== ProjectStatus.Published) {
      return firstPublishedAt;
    }
    return this.clock.now();
  }
}

function withoutUnchangedFields(
  payload: UpdateProjectPayload,
): UpdateProjectPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as UpdateProjectPayload;
}

function requireRenameAllowed(project: ProjectEntity): void {
  if (project.status === ProjectStatus.Published) {
    throw new BadRequestException({
      code: ApiErrorCode.SlugLocked,
      message:
        'A published project’s slug is a public URL; unpublish it before renaming',
    });
  }
}

function isSlugTakenViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { constraint?: string }).constraint === SLUG_INDEX
  );
}

function slugTaken(slug: string): ConflictException {
  return new ConflictException({
    code: ApiErrorCode.SlugTaken,
    message: `A project with slug "${slug}" already exists`,
  });
}

function projectNotFound(): NotFoundException {
  return new NotFoundException({
    code: ApiErrorCode.NotFound,
    message: 'There is no such project',
  });
}

function toProject(project: ProjectEntity): Project {
  return {
    slug: project.slug,
    name: project.name,
    tagline: project.tagline,
    kind: project.kind,
    role: project.role,
    period: project.period,
    stack: project.stack,
    bodyMarkdown: project.bodyMarkdown,
    ...(project.liveUrl && { liveUrl: project.liveUrl }),
    ...(project.repoUrl && { repoUrl: project.repoUrl }),
    ...(project.docsUrl && { docsUrl: project.docsUrl }),
    featured: project.featured,
    sortOrder: project.sortOrder,
  };
}

function toAdminProject(project: ProjectEntity): AdminProject {
  return {
    ...toProject(project),
    id: project.id,
    status: project.status,
    publishedAt: project.publishedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
