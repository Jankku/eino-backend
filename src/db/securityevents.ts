import { pgp } from './config';
import type { AuditAction } from './audit';
import type { SecurityFailure } from '../util/securityaudit';

// Explicitly allow reasons: routine errors, unknown reasons and legacy rows without
// a reason should never become dashboard alerts
export const securityEventReasons = {
  login_failed: ['invalid_credentials', 'invalid_otp', 'account_disabled'],
  authentication_failed: ['invalid_credentials', 'invalid_otp', 'account_disabled'],
  authorization_denied: ['insufficient_role', 'account_disabled'],
  two_factor_authentication_failed: ['invalid_otp'],
  password_reset_failed: ['invalid_otp', 'account_disabled'],
  email_verification_failed: ['invalid_otp'],
} as const satisfies Partial<Record<AuditAction, readonly SecurityFailure['reason'][]>>;

export type SecurityEventAction = keyof typeof securityEventReasons;

export const securityEventsWhere = `created_on >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
  AND created_on <= CURRENT_TIMESTAMP AND (${Object.entries(securityEventReasons)
    .map(([action, reasons]) =>
      pgp.as.format("(action = $1 AND new_data->>'reason' IN ($2:list))", [action, reasons]),
    )
    .join(' OR ')})`;
