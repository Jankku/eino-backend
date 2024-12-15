/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('user_book_list', { note: { type: 'text' } }, { ifNotExists: true });
  pgm.addColumn('user_movie_list', { note: { type: 'text' } }, { ifNotExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('user_book_list', 'note', { ifExists: true });
  pgm.dropColumn('user_movie_list', 'note', { ifExists: true });
}