import { DateTime } from 'luxon';

export const isVerificationExpired = (date: Date) => {
  const diff = DateTime.fromISO(date.toISOString(), {
    zone: 'utc',
  }).diffNow();
  return diff.milliseconds < 0;
};
