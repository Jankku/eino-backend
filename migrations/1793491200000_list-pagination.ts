/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/require-await */
import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql("CREATE COLLATION eino_list_en (provider = icu, locale = 'en')");
  pgm.createIndex('audit_log', ['created_on', 'id']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('audit_log', ['created_on', 'id']);
  pgm.sql('DROP COLLATION eino_list_en');
}
