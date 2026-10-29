/* eslint-disable unicorn/no-null -- SQL NULL represents an unauthenticated actor. */
import { Request, Response } from 'express';
import { LRUCache } from 'lru-cache';
import { addAudit, Audit, AuditAction } from '../db/audit';
import { db } from '../db/config';
import { Logger } from './logger';

const failureActions = {
  login: 'login_failed',
  login_config: 'login_failed',
  password_forgot: 'password_reset_failed',
  password_reset: 'password_reset_failed',
  email_verify: 'email_verification_failed',
  two_factor_enable: 'two_factor_authentication_failed',
  two_factor_disable: 'two_factor_authentication_failed',
  access_token: 'authentication_failed',
  refresh_token: 'authentication_failed',
  email_update: 'authentication_failed',
  account_delete: 'authentication_failed',
  profile_export: 'authentication_failed',
  role_check: 'authorization_denied',
  account_enabled_check: 'authorization_denied',
} as const satisfies Record<string, AuditAction>;

export type SecurityOperation = keyof typeof failureActions;

export type SecurityFailure = {
  operation: SecurityOperation;
  reason:
    | 'invalid_credentials'
    | 'password_policy_rejected'
    | 'account_not_found'
    | 'account_disabled'
    | 'otp_required'
    | 'invalid_otp'
    | 'verification_missing'
    | 'verification_expired'
    | 'email_unverified'
    | 'email_missing'
    | 'email_delivery_failed'
    | 'invalid_token'
    | 'expired_token'
    | 'invalid_authorization_header'
    | 'insufficient_role'
    | 'invalid_input';
  targetUserId?: string;
};

const failures = new LRUCache<string, { nextLogAt: number; suppressed: number }>({ max: 10_000 });
const failureWindowMs = 60_000;

const getAuditActor = (res: Response) => {
  const { userId, username } = res.locals;
  // These locals are set by verifyToken
  return typeof userId === 'string' && typeof username === 'string'
    ? { actor_user_id: userId, username }
    : { actor_user_id: null, username: null };
};

const startFailureWindow = (key: string) => {
  const previous = failures.get(key);
  const now = Date.now();
  if (previous && now < previous.nextLogAt) {
    previous.suppressed++;
    return;
  }

  const bucket = { nextLogAt: now + failureWindowMs, suppressed: 0 };
  failures.set(key, bucket);
  return {
    suppressedAttempts: previous?.suppressed ?? 0,
    cancel() {
      if (failures.peek(key) === bucket) failures.delete(key);
    },
  };
};

export const auditSecurityFailure = async (
  req: Request,
  res: Response,
  { operation, reason, targetUserId }: SecurityFailure,
): Promise<void> => {
  const actor = getAuditActor(res);
  const sourceIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const key = JSON.stringify([sourceIp, actor.actor_user_id, targetUserId, operation, reason]);

  const failureWindow = startFailureWindow(key);
  if (!failureWindow) return;

  const audit = {
    ...actor,
    // The operation comes from a closed union of application-defined values.
    // eslint-disable-next-line security/detect-object-injection
    action: failureActions[operation],
    table_name: targetUserId ? 'users' : undefined,
    record_id: targetUserId,
    new_data: {
      operation,
      reason,
      source_ip: sourceIp,
      method: req.method,
      suppressed_attempts: failureWindow.suppressedAttempts,
    },
  } satisfies Audit;

  try {
    await db.task('auditSecurityFailure', (t) => addAudit(t, audit));
  } catch {
    failureWindow.cancel();
    Logger.error('Failed to record security audit', { operation, reason });
  }
};
