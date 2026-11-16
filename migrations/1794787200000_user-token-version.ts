import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Tokens carry the version they were issued with. Incrementing it revokes every earlier token.
    ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN token_version;
  `);
}
