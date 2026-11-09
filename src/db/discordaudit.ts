import type { ITask } from 'pg-promise';
import { auditAction, type AuditAction, type DbAudit } from './audit.ts';
import { config } from '../config.ts';

export type DiscordAuditSettings = {
  enabled: boolean;
  actions: AuditAction[];
  last_success_on: Date | null;
  last_error: string | null;
};

export type DiscordAuditUpdate = {
  enabled?: boolean;
  actions?: AuditAction[];
};

export const getDiscordAuditStatus = async (t: ITask<unknown>) => {
  const settings = await t.one<DiscordAuditSettings & { pending_count: number }>(`
    SELECT enabled, actions, last_success_on, last_error,
      (SELECT COUNT(*) FROM discord_audit_queue) AS pending_count
    FROM discord_audit_settings WHERE id = true
  `);
  return {
    ...settings,
    webhook_configured: Boolean(config.DISCORD_AUDIT_LOG_WEBHOOK_URL),
    available_actions: Object.values(auditAction),
  };
};

// Call within a transaction, including the returned status read.
export const updateDiscordAuditSettings = async (t: ITask<unknown>, update: DiscordAuditUpdate) => {
  await t.one('SELECT id FROM discord_audit_settings WHERE id = true FOR UPDATE');
  await t.none(
    `UPDATE discord_audit_settings
     SET enabled = COALESCE($1, enabled), actions = COALESCE($2::text[], actions)
     WHERE id = true`,
    [update.enabled, update.actions],
  );
  if (update.enabled === false) {
    await t.none('DELETE FROM discord_audit_queue');
  }
  return getDiscordAuditStatus(t);
};

// Two embeds keep even full audit snapshots below Discord’s aggregate embed size limit.
// Remove before sending: each batch gets at most one delivery attempt, even after restart.
export const claimDiscordAuditBatch = async (t: ITask<unknown>): Promise<DbAudit[]> => {
  const { enabled } = await t.one<{ enabled: boolean }>(
    'SELECT enabled FROM discord_audit_settings WHERE id = true FOR UPDATE',
  );
  if (!enabled) return [];
  return t.any<DbAudit>(`
    WITH claimed AS (
      DELETE FROM discord_audit_queue
      WHERE audit_id IN (SELECT audit_id FROM discord_audit_queue ORDER BY audit_id LIMIT 2)
      RETURNING audit_id
    )
    SELECT audit_log.* FROM audit_log JOIN claimed ON audit_log.id = claimed.audit_id
    ORDER BY audit_log.id
  `);
};

export const recordDiscordAuditDelivery = async (t: ITask<unknown>, error: string | undefined) => {
  await t.none(
    `UPDATE discord_audit_settings
     SET last_success_on = CASE WHEN $1::text IS NULL THEN CURRENT_TIMESTAMP ELSE last_success_on END,
         last_error = $1
     WHERE id = true`,
    [error],
  );
};
