import type { Request } from 'express';
import type { ITask } from 'pg-promise';
import type { z } from 'zod';
import {
  disableTOTP,
  enableTOTP,
  findUserByCredential,
  findUserByEmail,
  findUserByEmailForUpdate,
  findUserById,
  findUserByIdForUpdate,
  upgradePassword,
  getUserByIdForUpdate,
  incrementTokenVersion,
  updateLastLogin,
  updatePassword,
  type User,
} from '../db/users.ts';
import { errorMessages } from '../util/errormessages.ts';
import { db } from '../db/config.ts';
import { success } from '../util/response.ts';
import { logError } from '../util/logger.ts';
import {
  generateAccessToken,
  generateRefreshToken,
  getPasswordStrength,
  verifyTokenClaims,
} from '../util/auth.ts';
import { ErrorWithStatus, SecurityErrorWithStatus } from '../util/errorhandler.ts';
import { config } from '../config.ts';
import type { TypedResponse } from '../util/zod.ts';
import type {
  enable2FASchema,
  forgotPasswordSchema,
  loginSchema,
  passwordStrengthSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from '../routes/auth/index.ts';
import { addVerification, deleteVerifications, findVerification } from '../db/verification.ts';
import {
  dummyEmailVerification,
  generateTOTP,
  validateEmailOTP,
  validateTOTP,
} from '../util/totp.ts';
import QRCode from 'qrcode';
import { DateTime } from 'luxon';
import { isVerificationExpired } from '../util/verification.ts';
import { sendEmail } from '../util/email.ts';
import { resetPasswordTemplate } from '../util/emailtemplates.ts';
import { addAudit } from '../db/audit.ts';
import { getDefaultRoleId } from '../db/role.ts';
import { auditSecurityFailure } from '../util/securityaudit.ts';
import { generatePasswordHash, shouldUpgradePassword, verifyPassword } from '../util/password.ts';

export const register = async (_: Request, res: TypedResponse<typeof registerSchema>) => {
  const { username, password, email } = res.locals.input.body;

  // Hashed before the transaction so no connection is held during the KDF.
  const hashedPassword = await generatePasswordHash(password);
  // An address that another account has verified is stored unverified like any other,
  // so the response doesn't reveal whether it belongs to an account. It can't be verified.
  await db.tx('register', async (t) => {
    const defaultRoleId = getDefaultRoleId();
    const user = await t.one<{ user_id: string }>({
      text: `INSERT INTO users (username, password, email, role_id)
           VALUES ($1, $2, $3, $4) RETURNING user_id`,
      values: [username, hashedPassword, email || undefined, defaultRoleId],
    });
    await addAudit(t, { actor_user_id: user.user_id, username, action: 'register' });
  });

  res.status(200).json(success([{ name: 'user_registered', message: username }]));
};

export const login = async (_: Request, res: TypedResponse<typeof loginSchema>) => {
  const { username: usernameOrEmail, password, twoFactorCode } = res.locals.input.body;

  const verifiedUser = await db.task('login', (t) => findUserByCredential(t, usernameOrEmail));
  const isCorrect = await verifyPassword(password, verifiedUser?.password);
  if (!verifiedUser || !isCorrect || verifiedUser.disabled_on) {
    throw new SecurityErrorWithStatus(
      422,
      'authentication_error',
      'Incorrect username or password',
      { operation: 'login', reason: 'invalid_credentials', targetUserId: verifiedUser?.user_id },
    );
  }

  const user = await db.tx('login', async (t) => {
    const currentUser = await findUserByIdForUpdate(t, verifiedUser.user_id);
    if (!currentUser || currentUser.disabled_on) {
      throw new SecurityErrorWithStatus(422, 'authentication_error', 'Account unavailable', {
        operation: 'login',
        reason: currentUser ? 'account_disabled' : 'account_not_found',
        targetUserId: verifiedUser.user_id,
      });
    }
    if (currentUser.password !== verifiedUser.password) {
      throw new SecurityErrorWithStatus(
        422,
        'authentication_error',
        'Incorrect username or password',
        { operation: 'login', reason: 'invalid_credentials', targetUserId: currentUser.user_id },
      );
    }

    if (currentUser.totp_enabled_on) {
      if (!twoFactorCode) {
        // Not a security failure: this is the normal first step of a 2FA login.
        throw new ErrorWithStatus(422, 'otp_required', errorMessages.OTP_REQUIRED);
      }

      const verification = await findVerification(t, {
        userId: currentUser.user_id,
        type: '2fa',
      });
      if (!verification || !validateTOTP({ otp: twoFactorCode, ...verification })) {
        throw new SecurityErrorWithStatus(
          422,
          'authentication_error',
          'Incorrect one-time password',
          { operation: 'login', reason: 'invalid_otp', targetUserId: currentUser.user_id },
        );
      }
    }

    await updateLastLogin(t, currentUser.user_id);
    await addAudit(t, {
      actor_user_id: currentUser.user_id,
      username: currentUser.username,
      action: 'login',
    });

    return currentUser;
  });

  if (shouldUpgradePassword(password, user.password)) {
    await upgradeLegacyPasswordHash(user, password).catch(logError);
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  res.status(200).json({ accessToken, refreshToken });
};

const upgradeLegacyPasswordHash = async (user: User, password: string) => {
  const newHash = await generatePasswordHash(password);
  await db.tx('upgradePassword', async (t) => {
    await upgradePassword(t, { userId: user.user_id, originalHash: user.password, newHash });
    await addAudit(t, {
      actor_user_id: user.user_id,
      username: user.username,
      action: 'password_hash_upgraded',
      table_name: 'users',
      record_id: user.user_id,
      old_data: { algorithm: 'bcrypt' },
      new_data: { algorithm: 'argon2id' },
    });
  });
};

export const generateNewAccessToken = async (
  _: Request,
  res: TypedResponse<typeof refreshTokenSchema>,
) => {
  const { refreshToken } = res.locals.input.body;

  const { userId, tokenVersion } = verifyTokenClaims(refreshToken, config.REFRESH_TOKEN_SECRET, {
    name: 'jwt_refresh_error',
    operation: 'refresh_token',
  });

  const accessToken = await db.task('generateNewAccessToken', async (t) => {
    const user = await findUserById(t, userId);
    if (!user) {
      throw new SecurityErrorWithStatus(401, 'authentication_error', 'Account no longer exists', {
        operation: 'refresh_token',
        reason: 'account_not_found',
        targetUserId: userId,
      });
    }
    if (user.disabled_on) {
      throw new SecurityErrorWithStatus(422, 'authentication_error', 'Account disabled', {
        operation: 'refresh_token',
        reason: 'account_disabled',
        targetUserId: user.user_id,
      });
    }
    if (user.token_version !== tokenVersion) {
      throw new SecurityErrorWithStatus(401, 'jwt_refresh_error', 'Token revoked', {
        operation: 'refresh_token',
        reason: 'revoked_token',
        targetUserId: user.user_id,
      });
    }
    const accessToken = generateAccessToken(user);
    await updateLastLogin(t, user.user_id);
    return accessToken;
  });

  res.status(200).json({ accessToken });
};

export const revokeSessions = async (_: Request, res: TypedResponse) => {
  await db.tx('revokeSessions', async (t) => {
    const user = await incrementTokenVersion(t, res.locals.userId);
    await addAudit(t, {
      actor_user_id: user.user_id,
      username: user.username,
      action: 'sessions_revoked',
    });
  });
  res
    .status(200)
    .json(success([{ name: 'sessions_revoked', message: 'Signed out of all sessions' }]));
};

export const passwordStrength = (_: Request, res: TypedResponse<typeof passwordStrengthSchema>) => {
  const { password } = res.locals.input.body;

  const { isStrong, score, error } = getPasswordStrength({ password });
  if (!isStrong) {
    res.status(200).json(success([{ message: error, score }]));
    return;
  }
  res.status(200).json(success([{ message: 'Password is strong', score }]));
};

const passwordResetJobs = new Set<Promise<void>>();

export const waitForPasswordResetJobs = async () => {
  await Promise.allSettled(passwordResetJobs);
};

const sendPasswordResetEmail = async (email: string, req: Request, res: TypedResponse) => {
  try {
    const { user, otp } = await db.tx('forgotPassword', async (t) => {
      // Locked so concurrent requests replace the code one after another.
      const user = await findUserByEmailForUpdate(t, email);
      if (!user || !user.email) {
        throw new SecurityErrorWithStatus(422, 'forget_password_error', 'Account not found', {
          operation: 'password_forgot',
          reason: 'account_not_found',
        });
      }

      if (user.disabled_on) {
        throw new SecurityErrorWithStatus(422, 'forget_password_error', 'Account disabled', {
          operation: 'password_forgot',
          reason: 'account_disabled',
          targetUserId: user.user_id,
        });
      }

      if (!user.email_verified_on) {
        throw new SecurityErrorWithStatus(422, 'forget_password_error', 'Email not verified', {
          operation: 'password_forgot',
          reason: 'email_unverified',
          targetUserId: user.user_id,
        });
      }

      await deleteVerifications(t, { userId: user.user_id, type: 'password_reset' });

      const { otp, secret, algorithm, digits, period, created_on } = generateTOTP({
        label: email,
      });

      await addVerification(t, {
        user_id: user.user_id,
        type: 'password_reset',
        target: email,
        secret,
        algorithm,
        digits,
        period,
        created_on,
        expires_on: DateTime.fromJSDate(created_on).plus({ minutes: 15 }).toJSDate(),
      });

      return { user, otp };
    });

    const emailResponse = await sendEmail({
      recipient: user.email!,
      template: resetPasswordTemplate(otp),
    });

    await db.task(
      'forgotPassword',
      async (t) =>
        await addAudit(t, {
          actor_user_id: user.user_id,
          username: user.username,
          action: 'password_forgot',
          new_data: { email, email_sent: emailResponse.success },
        }),
    );

    if (!emailResponse.success) {
      throw new SecurityErrorWithStatus(
        424,
        'forget_password_error',
        "Couldn't send password reset email",
        {
          operation: 'password_forgot',
          reason: 'email_delivery_failed',
          targetUserId: user.user_id,
        },
      );
    }
  } catch (error) {
    if (error instanceof SecurityErrorWithStatus) {
      await auditSecurityFailure(req, res, error.audit);
    } else {
      logError(error);
    }
  }
};

export const forgotPassword = (req: Request, res: TypedResponse<typeof forgotPasswordSchema>) => {
  const { email } = res.locals.input.body;
  // Start account-dependent work only after the generic response has been sent.
  // Track jobs so graceful shutdown waits for delivery and audit writes.
  res.once('finish', () => {
    const job = sendPasswordResetEmail(email, req, res).catch(logError);
    passwordResetJobs.add(job);
    void job.finally(() => passwordResetJobs.delete(job));
  });
  res.status(200).json(
    success([
      {
        name: 'password_reset_email_sent',
        message: 'If the account is eligible, a password reset email will be sent',
      },
    ]),
  );
};

type ResetPasswordInput = z.output<typeof resetPasswordSchema>['body'];

/**
Checks the reset code, the two-factor code, and the new password.
Runs before hashing without a lock, then again under the row lock before the password is saved.
*/
const validatePasswordReset = async (
  t: ITask<unknown>,
  user: User | null | undefined,
  { email, newPassword, otp, twoFactorCode }: ResetPasswordInput,
): Promise<User> => {
  // Queried without an account too, so unknown addresses take the same path.
  const verification = await findVerification(t, {
    userId: user?.user_id,
    type: 'password_reset',
    target: email,
  });
  const otpMatches = validateEmailOTP({ otp, ...(verification ?? dummyEmailVerification) });
  if (
    !user ||
    user.disabled_on ||
    !verification ||
    !otpMatches ||
    (verification.expires_on && isVerificationExpired(verification.expires_on))
  ) {
    throw new SecurityErrorWithStatus(
      422,
      'reset_password_error',
      'Invalid or expired one-time password',
      { operation: 'password_reset', reason: 'invalid_otp' },
    );
  }

  if (user.totp_enabled_on) {
    if (!twoFactorCode) {
      throw new SecurityErrorWithStatus(422, 'reset_password_error', 'Two-factor code required', {
        operation: 'password_reset',
        reason: 'otp_required',
        targetUserId: user.user_id,
      });
    }

    const twoFactorVerification = await findVerification(t, {
      userId: user.user_id,
      type: '2fa',
    });
    if (!twoFactorVerification || !validateTOTP({ otp: twoFactorCode, ...twoFactorVerification })) {
      throw new SecurityErrorWithStatus(422, 'reset_password_error', 'Incorrect two-factor code', {
        operation: 'password_reset',
        reason: 'invalid_otp',
        targetUserId: user.user_id,
      });
    }
  }

  const { isStrong, error } = getPasswordStrength({ password: newPassword });
  if (!isStrong) {
    throw new SecurityErrorWithStatus(422, 'reset_password_error', error, {
      operation: 'password_reset',
      reason: 'password_policy_rejected',
      targetUserId: user.user_id,
    });
  }

  return user;
};

export const resetPassword = async (_: Request, res: TypedResponse<typeof resetPasswordSchema>) => {
  const input = res.locals.input.body;

  // Validated first so invalid codes never cost a hash.
  await db.task('resetPassword', async (t) =>
    validatePasswordReset(t, await findUserByEmail(t, input.email), input),
  );
  // Hashed outside any transaction so no connection or row lock is held during the KDF.
  const hashedPassword = await generatePasswordHash(input.newPassword);

  await db.tx('resetPassword', async (t) => {
    // Locked and validated again so a code can be used only once.
    const user = await validatePasswordReset(
      t,
      await findUserByEmailForUpdate(t, input.email),
      input,
    );

    await updatePassword(t, { userId: user.user_id, hashedPassword });
    await incrementTokenVersion(t, user.user_id);
    await deleteVerifications(t, { userId: user.user_id, type: 'password_reset' });
    await addAudit(t, {
      actor_user_id: user.user_id,
      username: user.username,
      action: 'password_reseted',
    });
  });

  res
    .status(200)
    .json(success([{ name: 'password_reset_successful', message: 'Password reset successful' }]));
};

export const generate2FAUrl = async (_req: Request, res: TypedResponse) => {
  const userId = res.locals.userId;

  const { totpUrl } = await db.tx('generate2FAUrl', async (t) => {
    // Locked so the secret can't be replaced while it is being confirmed.
    const user = await getUserByIdForUpdate(t, userId);

    if (user.totp_enabled_on) {
      throw new ErrorWithStatus(422, '2fa_error', '2FA already enabled');
    }

    const verification = await findVerification(t, { userId, type: '2fa' });
    if (verification) {
      await deleteVerifications(t, { userId, type: '2fa' });
    }

    const { totpUrl, secret, digits, period, algorithm, label } = generateTOTP({
      label: user.username,
    });

    await addVerification(t, {
      user_id: userId,
      type: '2fa',
      target: label,
      secret,
      algorithm,
      digits,
      period,
    });

    await addAudit(t, {
      actor_user_id: user.user_id,
      username: user.username,
      action: 'two_factor_setup_generated',
      new_data: { replaced_existing: Boolean(verification) },
    });

    return { totpUrl };
  });

  const qrCodeUrl = await QRCode.toDataURL(totpUrl);

  res.status(200).json(success([{ totpUrl, qrCodeUrl }]));
};

export const enable2FA = async (_: Request, res: TypedResponse<typeof enable2FASchema>) => {
  const { twoFactorCode } = res.locals.input.body;
  const userId = res.locals.userId;

  const updatedUser = await db.tx('enable2FA', async (t) => {
    const user = await getUserByIdForUpdate(t, userId);

    if (user.totp_enabled_on) {
      throw new ErrorWithStatus(422, '2fa_error', '2FA already enabled');
    }

    const verification = await findVerification(t, { userId, type: '2fa' });
    if (!verification || !validateTOTP({ otp: twoFactorCode, ...verification })) {
      throw new SecurityErrorWithStatus(422, '2fa_error', 'Incorrect two-factor code', {
        operation: 'two_factor_enable',
        reason: 'invalid_otp',
        targetUserId: user.user_id,
      });
    }

    await enableTOTP(t, user.user_id);
    const updatedUser = await incrementTokenVersion(t, user.user_id);
    await addAudit(t, {
      actor_user_id: user.user_id,
      username: user.username,
      action: 'two_factor_authentication_enabled',
    });
    return updatedUser;
  });

  // Other sessions are revoked; the current one continues with fresh tokens.
  res.status(200).json(
    success([
      {
        name: '2fa_enabled',
        message: '2FA enabled',
        accessToken: generateAccessToken(updatedUser),
        refreshToken: generateRefreshToken(updatedUser),
      },
    ]),
  );
};

export const disable2FA = async (_: Request, res: TypedResponse<typeof enable2FASchema>) => {
  const { twoFactorCode } = res.locals.input.body;
  const userId = res.locals.userId;

  const updatedUser = await db.tx('disable2FA', async (t) => {
    const user = await getUserByIdForUpdate(t, userId);

    if (!user.totp_enabled_on) {
      throw new ErrorWithStatus(422, '2fa_error', '2FA not enabled');
    }

    const verification = await findVerification(t, { userId, type: '2fa' });
    if (!verification || !validateTOTP({ otp: twoFactorCode, ...verification })) {
      throw new SecurityErrorWithStatus(422, '2fa_error', 'Incorrect two-factor code', {
        operation: 'two_factor_disable',
        reason: 'invalid_otp',
        targetUserId: user.user_id,
      });
    }

    await deleteVerifications(t, { userId, type: '2fa' });
    await disableTOTP(t, user.user_id);
    const updatedUser = await incrementTokenVersion(t, user.user_id);
    await addAudit(t, {
      actor_user_id: user.user_id,
      username: user.username,
      action: 'two_factor_authentication_disabled',
    });
    return updatedUser;
  });

  // Other sessions are revoked; the current one continues with fresh tokens.
  res.status(200).json(
    success([
      {
        name: '2fa_disabled',
        message: '2FA disabled',
        accessToken: generateAccessToken(updatedUser),
        refreshToken: generateRefreshToken(updatedUser),
      },
    ]),
  );
};
