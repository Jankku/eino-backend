import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Usernames differing only by case would be indistinguishable to users.
    -- users_username_key stays, because other tables reference username.
    CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));

    -- An address is reserved only once verified, so unverified addresses can't be squatted.
    ALTER TABLE users DROP CONSTRAINT users_email_key;
    CREATE UNIQUE INDEX users_email_verified_key ON users (email) WHERE email_verified_on IS NOT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX users_email_verified_key;
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    DROP INDEX users_username_lower_key;
  `);
}
