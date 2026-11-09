import { config } from '../../config.ts';
import type { DbAudit } from '../../db/audit.ts';
import { auditToDiscordEmbed } from '../../util/audit.ts';
import { fetchResponse } from '../../util/http.ts';

export const sendAuditsToDiscord = async (audits: DbAudit[]): Promise<void> => {
  if (!config.DISCORD_AUDIT_LOG_WEBHOOK_URL) return;

  const url = new URL(config.DISCORD_AUDIT_LOG_WEBHOOK_URL);
  url.searchParams.set('wait', 'true');
  const response = await fetchResponse(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: audits.map((audit) => auditToDiscordEmbed(audit)),
      allowed_mentions: { parse: [] },
    }),
  });
  await response.body?.cancel();
};
