/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
import dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

export const shorthands: ColumnDefinitions | undefined = undefined;

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

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword)
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env file');

  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  pgm.sql(
    `INSERT INTO users (username, password, role_id, role_modified_on) VALUES ('${adminUsername}', '${hashedPassword}', (SELECT id FROM roles WHERE name = 'admin'), CURRENT_TIMESTAMP);`,
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('users', ['role_id', 'role_modified_on'], { ifExists: true });
  pgm.dropTable('roles', { ifExists: true });
  pgm.sql(`DELETE FROM users WHERE username = '${process.env.ADMIN_USERNAME}';`);
}
