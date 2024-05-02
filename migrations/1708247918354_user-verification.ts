/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('verifications', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    type: { type: 'text', notNull: true },
    target: { type: 'text', notNull: true },
    secret: { type: 'text', notNull: true },
    algorithm: { type: 'text', notNull: true },
    digits: { type: 'integer', notNull: true },
    period: { type: 'integer', notNull: true },
    created_on: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP(0)') },
    expires_on: { type: 'timestamptz', notNull: false },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('verifications');
}
