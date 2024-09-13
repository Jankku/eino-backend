/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(
    'audit_log',
    {
      id: { type: 'serial', primaryKey: true },
      username: { type: 'text', notNull: true },
      action: { type: 'text', notNull: true },
      table_name: { type: 'text' },
      record_id: { type: 'uuid' },
      old_data: { type: 'jsonb' },
      new_data: { type: 'jsonb' },
      created_on: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createIndex('audit_log', ['created_on'], { ifNotExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('audit_log', { ifExists: true });
}
