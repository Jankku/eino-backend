import { DateTime } from 'luxon';
import { AuditAction, getAuditsByActionNewerThan } from '../db/audit';
import { db } from '../db/config';
import { Logger } from '../util/logger';
import { sendAuditsToDiscord } from './third-party/discord';
import { chunkArray, sequentially, wait } from '../util/audit';
import { config } from '../config';

const discordAuditActions: AuditAction[] = [
  'register',
  'login',
  'account_deleted',
  'email_updated',
  'email_verification_email_sent',
  'email_verified',
  'password_forgot',
  'password_reset_email_sent',
  'password_reseted',
  'two_factor_authentication_enabled',
  'two_factor_authentication_disabled',
];

let lastProcessed = DateTime.utc();

const processAuditsDiscord = async () => {
  Logger.profile('processAuditsDiscord');

  const audits = await db.task(
    'processAuditsDiscord',
    async (t) =>
      await getAuditsByActionNewerThan(t, {
        actions: discordAuditActions,
        date: lastProcessed.toJSDate(),
      }),
  );

  if (audits.length === 0) return;

  lastProcessed = DateTime.utc();

  Logger.info(`Processing ${audits.length} audits and sending to Discord`);

  const chunkedAudits = chunkArray(audits, 10);
  await sequentially(chunkedAudits, async (chunk) => {
    await wait(1000);
    await sendAuditsToDiscord(chunk);
  });

  Logger.profile('processAuditsDiscord');
};

export const initDiscordAuditProcessing = () => {
  if (config.DISCORD_AUDIT_LOG_WEBHOOK_URL) {
    Logger.info('Starting to send audits to Discord');
    setInterval(processAuditsDiscord, 1000 * 60 * 1); // 1 minute
  }
};
