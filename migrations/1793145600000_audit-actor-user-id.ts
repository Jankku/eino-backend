/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('audit_log', {
    actor_user_id: { type: 'uuid' },
  });
  pgm.createIndex('audit_log', ['actor_user_id', 'created_on']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('audit_log', ['actor_user_id', 'created_on']);
  pgm.dropColumns('audit_log', ['actor_user_id']);
}
