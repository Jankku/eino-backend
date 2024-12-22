/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(
    'bulletins',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
      title: { type: 'text', notNull: true },
      content: { type: 'text' },
      visibility: { type: 'text', notNull: true },
      condition: { type: 'text' },
      start_date: {
        type: 'timestamptz',
        notNull: true,
      },
      end_date: {
        type: 'timestamptz',
        notNull: true,
      },
      created_on: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('CURRENT_TIMESTAMP'),
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable('bulletin_users', {
    id: { type: 'serial', primaryKey: true },
    bulletin_id: {
      type: 'uuid',
      notNull: true,
      references: 'bulletins',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    created_on: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('bulletins');
  pgm.dropTable('bulletin_users');
}
