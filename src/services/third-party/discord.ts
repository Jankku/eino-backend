import axios from 'axios';
import { config } from '../../config';
import { DbAudit } from '../../db/audit';
import { Logger } from '../../util/logger';
import { auditToDiscordEmbed } from '../../util/audit';

export const sendAuditsToDiscord = async (audits: DbAudit[]): Promise<void> => {
  if (!config.DISCORD_AUDIT_LOG_WEBHOOK_URL) return;

  try {
    await axios.post(new URL(config.DISCORD_AUDIT_LOG_WEBHOOK_URL).toString(), {
      embeds: audits.map((audit) => auditToDiscordEmbed(audit)),
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      Logger.error(
        `Failed to send audit log to Discord webhook: ${error.response?.status} ${error.response?.statusText}`,
        { error: error.toJSON(), audits },
      );
    }
  }
};
