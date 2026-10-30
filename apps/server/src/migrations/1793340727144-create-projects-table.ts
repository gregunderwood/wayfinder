import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectsTable1793340727144 implements MigrationInterface {
  name = 'CreateProjectsTable1793340727144';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL,
        name text NOT NULL,
        tagline text NOT NULL,
        kind text NOT NULL
          CONSTRAINT ck_projects_kind CHECK (kind IN ('employment', 'volunteer', 'personal')),
        role text NOT NULL,
        period text NOT NULL,
        stack text[] NOT NULL DEFAULT '{}',
        body_markdown text NOT NULL,
        live_url text,
        repo_url text,
        docs_url text,
        featured boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'draft'
          CONSTRAINT ck_projects_status CHECK (status IN ('draft', 'published')),
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX ux_projects_slug ON projects (slug)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE projects');
  }
}
