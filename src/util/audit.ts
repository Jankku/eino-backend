/* oxlint-disable unicorn/no-array-reduce */
/* oxlint-disable unicorn/numeric-separators-style */
import type { DbAudit } from '../db/audit.ts';

const DISCORD_COLOR_BLUE = 3447003;

export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    const chunk = array.slice(i, i + size);
    result.push(chunk);
  }
  return result;
};

export const sequentially = async <T, P>(
  elements: T[],
  toPromise: (element: T) => Promise<P>,
): Promise<P[]> => {
  const results: P[] = [];
  await elements.reduce(async (sequence, element) => {
    await sequence;
    results.push(await toPromise(element));
  }, Promise.resolve());

  return results;
};

export const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const truncate = (text: string, length: number): string =>
  text.length > length ? `${text.slice(0, length - 3)}...` : text;

const serializeDiscordAuditData = (data: Record<string, unknown>): string =>
  JSON.stringify(data, (key, value: unknown) => (key === 'email' ? undefined : value));

type DiscordEmbed = {
  timestamp: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
};

export const auditToDiscordEmbed = (audit: DbAudit): DiscordEmbed => {
  const fields = [
    {
      name: 'Username',
      value: audit.username ?? 'Unknown',
      inline: true,
    },
    {
      name: 'Action',
      value: audit.action,
      inline: true,
    },
  ];

  if (audit.table_name) {
    fields.push({
      name: 'Table',
      value: audit.table_name,
      inline: true,
    });
  }

  if (audit.record_id) {
    fields.push({
      name: 'Record ID',
      value: audit.record_id,
      inline: true,
    });
  }

  if (audit.old_data) {
    fields.push({
      name: 'Old Data',
      value: truncate(serializeDiscordAuditData(audit.old_data), 1024),
      inline: false,
    });
  }

  if (audit.new_data) {
    fields.push({
      name: 'New Data',
      value: truncate(serializeDiscordAuditData(audit.new_data), 1024),
      inline: false,
    });
  }

  return {
    timestamp: audit.created_on.toISOString(),
    color: DISCORD_COLOR_BLUE,
    fields,
  };
};
