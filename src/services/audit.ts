import { db } from '../db/config.ts';
import { claimDiscordAuditBatch, recordDiscordAuditDelivery } from '../db/discordaudit.ts';
import { Logger } from '../util/logger.ts';
import { sendAuditsToDiscord } from './third-party/discord.ts';
import { config } from '../config.ts';

const IDLE_POLL_MS = 60_000;
const BATCH_DELAY_MS = 1000;

let settingsVersion = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let processing: Promise<void> | undefined;
let stopped = true;

const processAuditsDiscord = async () => {
  const audits = await db.tx('claimDiscordAuditBatch', claimDiscordAuditBatch);
  if (audits.length === 0) return false;

  let errorMessage: string | undefined;
  try {
    await sendAuditsToDiscord(audits);
  } catch {
    errorMessage = 'Discord webhook delivery failed';
    Logger.error(errorMessage, { auditIds: audits.map((audit) => audit.id) });
  }
  await db.task((t) => recordDiscordAuditDelivery(t, errorMessage));
  return true;
};

const schedule = (delay: number) => {
  timer = setTimeout(() => {
    timer = undefined;
    let nextDelay = IDLE_POLL_MS;
    processing = processAuditsDiscord()
      .then((hadAudits) => {
        if (hadAudits) nextDelay = BATCH_DELAY_MS;
      })
      .catch(() => {
        Logger.error('Failed to process Discord audit queue');
      })
      .finally(() => {
        processing = undefined;
        if (!stopped) schedule(nextDelay);
      });
  }, delay);
};

// Called after the settings transaction commits; no polling is needed while disabled.
export const setDiscordAuditProcessingEnabled = (enabled: boolean) => {
  settingsVersion++;
  const shouldStop = !enabled || !config.DISCORD_AUDIT_LOG_WEBHOOK_URL;
  if (stopped === shouldStop) return;
  stopped = shouldStop;
  clearTimeout(timer);
  timer = undefined;
  // An in-flight batch will schedule the next one when it finishes.
  if (!stopped && !processing) schedule(0);
};

export const initDiscordAuditProcessing = async () => {
  if (!config.DISCORD_AUDIT_LOG_WEBHOOK_URL || !stopped) return;
  const version = settingsVersion;
  const { enabled } = await db.task((t) =>
    t.one<{ enabled: boolean }>('SELECT enabled FROM discord_audit_settings WHERE id = true'),
  );
  // A settings change or shutdown during this read takes precedence over startup.
  if (version === settingsVersion) setDiscordAuditProcessingEnabled(enabled);
};

export const stopDiscordAuditProcessing = async () => {
  settingsVersion++;
  stopped = true;
  clearTimeout(timer);
  timer = undefined;
  await processing;
};
