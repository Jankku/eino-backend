/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Interval 3 hours because we assume that users have created books and movies in GMT+3 timezone.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('user_book_list', 'start_date', {
    type: 'timestamptz',
    allowNull: true,
    using: "(start_date::timestamp - INTERVAL '3 hours')",
  });
  pgm.alterColumn('user_book_list', 'end_date', {
    type: 'timestamptz',
    allowNull: true,
    using: "(end_date::timestamp - INTERVAL '3 hours')",
  });

  pgm.alterColumn('user_movie_list', 'start_date', {
    type: 'timestamptz',
    allowNull: true,
    using: "(start_date::timestamp - INTERVAL '3 hours')",
  });
  pgm.alterColumn('user_movie_list', 'end_date', {
    type: 'timestamptz',
    allowNull: true,
    using: "(end_date::timestamp - INTERVAL '3 hours')",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('user_book_list', 'start_date', {
    type: 'DATE',
    allowNull: true,
    using: "(start_date AT TIME ZONE 'UTC' + INTERVAL '3 hours')::date",
  });
  pgm.alterColumn('user_book_list', 'end_date', {
    type: 'DATE',
    allowNull: true,
    using: "(end_date AT TIME ZONE 'UTC' + INTERVAL '3 hours')::date",
  });

  pgm.alterColumn('user_movie_list', 'start_date', {
    type: 'DATE',
    allowNull: true,
    using: "(start_date AT TIME ZONE 'UTC' + INTERVAL '3 hours')::date",
  });
  pgm.alterColumn('user_movie_list', 'end_date', {
    type: 'DATE',
    allowNull: true,
    using: "(end_date AT TIME ZONE 'UTC' + INTERVAL '3 hours')::date",
  });
}
