import type {
  CreateProjectPayload,
  ProjectKind,
  ProjectStatus,
} from '@wayfinder/domain';
import {
  IsBodyMarkdown,
  IsFlag,
  IsOptionalLink,
  IsPeriod,
  IsProjectKind,
  IsProjectStatus,
  IsShortText,
  IsSlug,
  IsSortOrder,
  IsStack,
  IsTagline,
} from './project-field-rules';

export class CreateProjectDto implements CreateProjectPayload {
  @IsSlug()
  slug!: string;

  @IsShortText()
  name!: string;

  @IsTagline()
  tagline!: string;

  @IsProjectKind()
  kind!: ProjectKind;

  @IsShortText()
  role!: string;

  @IsPeriod()
  period!: string;

  @IsStack()
  stack!: string[];

  @IsBodyMarkdown()
  bodyMarkdown!: string;

  @IsOptionalLink()
  liveUrl?: string | null;

  @IsOptionalLink()
  repoUrl?: string | null;

  @IsOptionalLink()
  docsUrl?: string | null;

  @IsFlag()
  featured!: boolean;

  @IsSortOrder()
  sortOrder!: number;

  @IsProjectStatus()
  status!: ProjectStatus;
}
