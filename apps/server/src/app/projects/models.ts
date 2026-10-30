import { ProjectKind, ProjectStatus } from '@wayfinder/domain';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const SLUG_INDEX = 'ux_projects_slug';

@Entity({ name: 'projects' })
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index(SLUG_INDEX, { unique: true })
  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  tagline!: string;

  @Column({ type: 'text' })
  kind!: ProjectKind;

  @Column({ type: 'text' })
  role!: string;

  @Column({ type: 'text' })
  period!: string;

  @Column({ type: 'text', array: true })
  stack!: string[];

  @Column({ name: 'body_markdown', type: 'text' })
  bodyMarkdown!: string;

  @Column({ name: 'live_url', type: 'text', nullable: true })
  liveUrl!: string | null;

  @Column({ name: 'repo_url', type: 'text', nullable: true })
  repoUrl!: string | null;

  @Column({ name: 'docs_url', type: 'text', nullable: true })
  docsUrl!: string | null;

  @Column({ type: 'boolean' })
  featured!: boolean;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder!: number;

  @Column({ type: 'text' })
  status!: ProjectStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
