import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AdminProject } from '@wayfinder/domain';
import { AdminGuard } from '../auth/admin.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('admin/projects')
@UseGuards(AdminGuard)
export class AdminProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(): Promise<AdminProject[]> {
    return this.projects.listAll();
  }

  @Get(':id')
  show(@Param('id', ParseUUIDPipe) id: string): Promise<AdminProject> {
    return this.projects.findById(id);
  }

  @Post()
  create(@Body() payload: CreateProjectDto): Promise<AdminProject> {
    return this.projects.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: UpdateProjectDto,
  ): Promise<AdminProject> {
    return this.projects.update(id, payload);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.projects.remove(id);
  }
}
