import { Controller, Get, Param } from '@nestjs/common';
import type { Project, ProjectSummary } from '@wayfinder/domain';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(): Promise<ProjectSummary[]> {
    return this.projects.listPublished();
  }

  @Get(':slug')
  find(@Param('slug') slug: string): Promise<Project> {
    return this.projects.findPublished(slug);
  }
}
