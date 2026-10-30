import { applyDecorators } from '@nestjs/common';
import {
  PROJECT_SLUG_PATTERN,
  PROJECT_TAGLINE_MAX_LENGTH,
  ProjectKind,
  ProjectStatus,
} from '@wayfinder/domain';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const LONGEST_SLUG = 100;
const LONGEST_SHORT_TEXT = 120;
const LONGEST_PERIOD = 60;
const MOST_STACK_ENTRIES = 30;
const LONGEST_STACK_ENTRY = 60;
const LONGEST_BODY = 100_000;
const LONGEST_URL = 2048;
const HIGHEST_SORT_ORDER = 10_000;

type PropertyRules = () => PropertyDecorator;

// Unlike IsOptional, lets an absent field through but still rejects null.
export const IsOmittable: PropertyRules = () =>
  ValidateIf((_payload, value) => value !== undefined);

export const IsSlug: PropertyRules = () =>
  applyDecorators(
    IsString(),
    MaxLength(LONGEST_SLUG),
    Matches(PROJECT_SLUG_PATTERN, {
      message: 'slug must be lowercase words joined by single hyphens',
    }),
  );

export const IsShortText: PropertyRules = () =>
  applyDecorators(IsString(), IsNotEmpty(), MaxLength(LONGEST_SHORT_TEXT));

export const IsTagline: PropertyRules = () =>
  applyDecorators(
    IsString(),
    IsNotEmpty(),
    MaxLength(PROJECT_TAGLINE_MAX_LENGTH),
  );

export const IsPeriod: PropertyRules = () =>
  applyDecorators(IsString(), IsNotEmpty(), MaxLength(LONGEST_PERIOD));

export const IsProjectKind: PropertyRules = () => IsEnum(ProjectKind);

export const IsProjectStatus: PropertyRules = () => IsEnum(ProjectStatus);

export const IsStack: PropertyRules = () =>
  applyDecorators(
    IsArray(),
    ArrayMaxSize(MOST_STACK_ENTRIES),
    IsString({ each: true }),
    IsNotEmpty({ each: true }),
    MaxLength(LONGEST_STACK_ENTRY, { each: true }),
  );

export const IsBodyMarkdown: PropertyRules = () =>
  applyDecorators(IsString(), MaxLength(LONGEST_BODY));

export const IsOptionalLink: PropertyRules = () =>
  applyDecorators(
    IsOptional(),
    IsUrl({ protocols: ['http', 'https'], require_protocol: true }),
    MaxLength(LONGEST_URL),
  );

export const IsFlag: PropertyRules = () => IsBoolean();

export const IsSortOrder: PropertyRules = () =>
  applyDecorators(IsInt(), Min(0), Max(HIGHEST_SORT_ORDER));
