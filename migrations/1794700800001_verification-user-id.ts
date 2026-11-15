import type { MigrationBuilder } from 'node-pg-migrate';

// Verifications belong to an account, so they follow renames and are deleted with it.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE verifications
      ADD COLUMN user_id uuid REFERENCES users (user_id) ON DELETE CASCADE;

    -- 2FA secrets were keyed by username, email codes by the address they were sent to.
    -- A row older than the account belongs to a deleted account that used the same
    -- username or address. The slack covers users.created_on being rounded to seconds.
    UPDATE verifications v SET user_id = u.user_id
    FROM users u
    WHERE v.target = CASE WHEN v.type = '2fa' THEN u.username ELSE u.email END
      AND v.created_on > u.created_on - interval '1 second';

    -- The rest belong to deleted accounts or replaced addresses, which no code can use.
    DELETE FROM verifications WHERE user_id IS NULL;
    ALTER TABLE verifications ALTER COLUMN user_id SET NOT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Username-keyed 2FA lookups need the current username after renames.
    UPDATE verifications v SET target = u.username
    FROM users u
    WHERE v.user_id = u.user_id AND v.type = '2fa';

    ALTER TABLE verifications DROP COLUMN user_id;
  `);
}
