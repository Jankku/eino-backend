import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

// This migration used to create the admin account from ADMIN_USERNAME and ADMIN_PASSWORD,
// and its rollback deleted that account. Accounts are now created with `npm run create-admin`.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('roles', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'text', unique: true, notNull: true },
    created_on: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.sql(`INSERT INTO roles (name) VALUES ('admin'), ('basic'), ('demo');`);

  pgm.addColumn(
    'users',
    {
      role_id: { type: 'integer', references: 'roles', onDelete: 'RESTRICT' },
      role_modified_on: { type: 'timestamptz' },
    },
    { ifNotExists: true },
  );
  pgm.sql(
    `UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'basic'), role_modified_on = CURRENT_TIMESTAMP;`,
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('users', ['role_id', 'role_modified_on'], { ifExists: true });
  pgm.dropTable('roles', { ifExists: true });
}
