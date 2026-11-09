import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE discord_audit_settings (
      id boolean PRIMARY KEY DEFAULT true CHECK (id),
      enabled boolean NOT NULL DEFAULT false,
      actions text[] NOT NULL DEFAULT '{}',
      last_success_on timestamptz,
      last_error text
    );
    INSERT INTO discord_audit_settings DEFAULT VALUES;

    CREATE TABLE discord_audit_queue (
      audit_id integer PRIMARY KEY REFERENCES audit_log(id) ON DELETE CASCADE
    );

    CREATE FUNCTION queue_discord_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      settings discord_audit_settings%ROWTYPE;
    BEGIN
      -- Serialize eligibility decisions with settings changes and disabling.
      SELECT * INTO settings FROM discord_audit_settings WHERE id = true FOR SHARE;
      IF settings.enabled AND NEW.action = ANY(settings.actions) THEN
        INSERT INTO discord_audit_queue (audit_id) VALUES (NEW.id);
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER queue_discord_audit AFTER INSERT ON audit_log
      FOR EACH ROW EXECUTE FUNCTION queue_discord_audit();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TRIGGER queue_discord_audit ON audit_log;
    DROP FUNCTION queue_discord_audit();
    DROP TABLE discord_audit_queue;
    DROP TABLE discord_audit_settings;
  `);
}
