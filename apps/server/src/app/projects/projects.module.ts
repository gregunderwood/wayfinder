import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clock, SystemClock } from '../common/clock';
import { AdminProjectsController } from './admin-projects.controller';
import { ProjectEntity } from './models';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity]), AuthModule],
  controllers: [ProjectsController, AdminProjectsController],
  providers: [{ provide: Clock, useClass: SystemClock }, ProjectsService],
})
export class ProjectsModule {}
