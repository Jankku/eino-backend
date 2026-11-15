import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- A share lookup expects exactly one row per id.
    ALTER TABLE shares ADD CONSTRAINT shares_share_id_key UNIQUE (share_id);

    -- Duplicate recipient rows repeat the same pair, so only one of each is kept.
    DELETE FROM bulletin_users a
    USING bulletin_users b
    WHERE a.bulletin_id = b.bulletin_id AND a.user_id = b.user_id AND a.id > b.id;
    ALTER TABLE bulletin_users
      ADD CONSTRAINT bulletin_users_bulletin_id_user_id_key UNIQUE (bulletin_id, user_id);

    ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE users ALTER COLUMN role_id DROP NOT NULL;
    ALTER TABLE bulletin_users DROP CONSTRAINT bulletin_users_bulletin_id_user_id_key;
    ALTER TABLE shares DROP CONSTRAINT shares_share_id_key;
  `);
}
