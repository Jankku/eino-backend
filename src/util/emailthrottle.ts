import { LRUCache } from 'lru-cache';

type EmailKind = 'email_confirmation' | 'password_reset';

const cooldownMs = 60_000;
const windowMs = 60 * 60_000;
const maxEmailsPerWindow = 5;

const sendTimes = new LRUCache<string, number[]>({ max: 10_000, ttl: windowMs });

const nextAllowedAt = (recentSends: number[]): number => {
  const latest = recentSends.at(-1);
  if (latest === undefined) return 0;

  const cooldownEndsAt = latest + cooldownMs;
  if (recentSends.length < maxEmailsPerWindow) return cooldownEndsAt;

  const oldestLeavesWindowAt = recentSends[0] + windowMs;
  return Math.max(cooldownEndsAt, oldestLeavesWindowAt);
};

// Must stay synchronous so concurrent requests can't both pass the check.
export const reserveEmailSend = (kind: EmailKind, userId: string): number => {
  const key = `${kind}:${userId}`;
  const now = Date.now();
  const recentSends = (sendTimes.get(key) ?? []).filter((sentAt) => sentAt > now - windowMs);

  const allowedAt = nextAllowedAt(recentSends);
  if (allowedAt > now) {
    return Math.ceil((allowedAt - now) / 1000);
  }

  sendTimes.set(key, [...recentSends, now]);
  return 0;
};
