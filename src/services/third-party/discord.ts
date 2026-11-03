import { config } from '../../config.ts';
import type { DbAudit } from '../../db/audit.ts';
import { Logger } from '../../util/logger.ts';
import { auditToDiscordEmbed } from '../../util/audit.ts';
import { fetchResponse, HttpError } from '../../util/http.ts';

export const sendAuditsToDiscord = async (audits: DbAudit[]): Promise<void> => {
  if (!config.DISCORD_AUDIT_LOG_WEBHOOK_URL) return;

  try {
    const response = await fetchResponse(config.DISCORD_AUDIT_LOG_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: audits.map((audit) => auditToDiscordEmbed(audit)) }),
    });
    await response.body?.cancel();
  } catch (error) {
    const status =
      error instanceof HttpError ? `${error.status} ${error.statusText}` : 'request failed';
    Logger.error(`Failed to send audit log to Discord webhook: ${status}`, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      audits,
    });
  }
};
