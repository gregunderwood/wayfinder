import type {
  ProjectKind,
  ProjectStatus,
  UpdateProjectPayload,
} from '@wayfinder/domain';
import {
  IsBodyMarkdown,
  IsFlag,
  IsOmittable,
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

export class UpdateProjectDto implements UpdateProjectPayload {
  @IsOmittable()
  @IsSlug()
  slug?: string;

  @IsOmittable()
  @IsShortText()
  name?: string;

  @IsOmittable()
  @IsTagline()
  tagline?: string;

  @IsOmittable()
  @IsProjectKind()
  kind?: ProjectKind;

  @IsOmittable()
  @IsShortText()
  role?: string;

  @IsOmittable()
  @IsPeriod()
  period?: string;

  @IsOmittable()
  @IsStack()
  stack?: string[];

  @IsOmittable()
  @IsBodyMarkdown()
  bodyMarkdown?: string;

  @IsOptionalLink()
  liveUrl?: string | null;

  @IsOptionalLink()
  repoUrl?: string | null;

  @IsOptionalLink()
  docsUrl?: string | null;

  @IsOmittable()
  @IsFlag()
  featured?: boolean;

  @IsOmittable()
  @IsSortOrder()
  sortOrder?: number;

  @IsOmittable()
  @IsProjectStatus()
  status?: ProjectStatus;
}
