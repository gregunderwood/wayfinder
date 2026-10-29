import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1793155154390 implements MigrationInterface {
  name = 'CreateAuthTables1793155154390';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE admin_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        encrypted_email text NOT NULL,
        password_hash text NOT NULL,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // The site has exactly one admin; a unique index on a constant makes a second row impossible.
    await queryRunner.query(
      'CREATE UNIQUE INDEX ux_admin_users_single_admin ON admin_users ((true))',
    );
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_user_id uuid NOT NULL
          CONSTRAINT fk_refresh_tokens_admin_user
          REFERENCES admin_users (id) ON DELETE CASCADE,
        family_id uuid NOT NULL,
        token_hash text NOT NULL CONSTRAINT ux_refresh_tokens_token_hash UNIQUE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_refresh_tokens_family_id ON refresh_tokens (family_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE refresh_tokens');
    await queryRunner.query('DROP TABLE admin_users');
  }
}
