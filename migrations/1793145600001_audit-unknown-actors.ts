/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Unauthenticated events have neither an actor UUID nor a username.
  pgm.alterColumn('audit_log', 'username', { notNull: false });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql("UPDATE audit_log SET username = '[unknown]' WHERE username IS NULL");
  pgm.alterColumn('audit_log', 'username', { notNull: true });
}
