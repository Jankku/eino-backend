/* eslint-disable unicorn/filename-case */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('users', { email: { type: 'text', unique: true } }, { ifNotExists: true });
  pgm.addColumn('users', { email_verified_on: { type: 'timestamptz' } }, { ifNotExists: true });
  pgm.addColumn('users', { last_login_on: { type: 'timestamptz' } }, { ifNotExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('users', 'email', { ifExists: true });
  pgm.dropColumn('users', 'email_verified_on', { ifExists: true });
  pgm.dropColumn('users', 'last_login_on', { ifExists: true });
}
