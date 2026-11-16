import type { NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import {
  disableTOTP,
  enableTOTP,
  findUserByCredential,
  findUserByEmailForUpdate,
  findUserById,
  findUserByIdForUpdate,
  upgradePassword,
  getUserByIdForUpdate,
  incrementTokenVersion,
  updateLastLogin,
  updatePassword,
} from '../db/users.ts';
import { db } from '../db/config.ts';
import { success } from '../util/response.ts';
import { logError } from '../util/logger.ts';
import {
  generateAccessToken,
  generateRefreshToken,
  getPasswordStrength,
  getTokenClaims,
} from '../util/auth.ts';
import { ErrorWithStatus, SecurityErrorWithStatus } from '../util/errorhandler.ts';
import { config } from '../config.ts';
import type { TypedResponse } from '../util/zod.ts';
import type {
  enable2FASchema,
  forgotPasswordSchema,
  loginConfigSchema,
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
import { jwtConstants } from '../util/jwtconstants.ts';
import { auditSecurityFailure } from '../util/securityaudit.ts';
import { generatePasswordHash, shouldUpgradePassword, verifyPassword } from '../util/password.ts';

export const register = async (
  _: Request,
  res: TypedResponse<typeof registerSchema>,
  next: NextFunction,
) => {
  const { username, password, email } = res.locals.input.body;

  try {
    await db.tx('register', async (t) => {
      const hashedPassword = await generatePasswordHash(password);
      const defaultRoleId = getDefaultRoleId();
      const user = await t.one<{ user_id: string }>({
        text: `INSERT INTO users (username, password, email, role_id)
             VALUES ($1, $2, $3, $4) RETURNING user_id`,
        values: [username, hashedPassword, email || undefined, defaultRoleId],
      });
      await addAudit(t, { actor_user_id: user.user_id, username, action: 'register' });
    });

    res.status(200).json(success([{ name: 'user_registered', message: username }]));
  } catch (error) {
    logError(error);
    next(
      new ErrorWithStatus(
        500,
        'authentication_error',
        'Unknown error while trying to register user',
      ),
    );
  }
};

export const login = async (
  _: Request,
  res: TypedResponse<typeof loginSchema>,
  next: NextFunction,
) => {
  const { username: usernameOrEmail, password, twoFactorCode } = res.locals.input.body;

  try {
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
          throw new SecurityErrorWithStatus(
            422,
            'authentication_error',
            'One-time password required',
            { operation: 'login', reason: 'otp_required', targetUserId: currentUser.user_id },
          );
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

      const newHash = shouldUpgradePassword(password, verifiedUser.password)
        ? await generatePasswordHash(password)
        : undefined;

      if (newHash) {
        await upgradePassword(t, {
          userId: currentUser.user_id,
          originalHash: currentUser.password,
          newHash,
        });
        await addAudit(t, {
          actor_user_id: currentUser.user_id,
          username: currentUser.username,
          action: 'password_hash_upgraded',
          table_name: 'users',
          record_id: currentUser.user_id,
          old_data: { algorithm: 'bcrypt' },
          new_data: { algorithm: 'argon2id' },
        });
      }

      await updateLastLogin(t, currentUser.user_id);
      await addAudit(t, {
        actor_user_id: currentUser.user_id,
        username: currentUser.username,
        action: 'login',
      });

      return currentUser;
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({ accessToken, refreshToken });
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      logError(error);
      next(new ErrorWithStatus(500, 'authentication_error', 'Incorrect username or password'));
    }
  }
};

export const loginConfig = async (
  _: Request,
  res: TypedResponse<typeof loginConfigSchema>,
  next: NextFunction,
) => {
  const { username: usernameOrEmail, password } = res.locals.input.body;

  try {
    const { user } = await db.tx('loginConfig', async (t) => {
      const foundUser = await findUserByCredential(t, usernameOrEmail);
      const isCorrect = await verifyPassword(password, foundUser?.password);
      if (!foundUser || !isCorrect || foundUser.disabled_on) {
        throw new SecurityErrorWithStatus(
          422,
          'authentication_error',
          'Incorrect username or password',
          {
            operation: 'login_config',
            reason: 'invalid_credentials',
            targetUserId: foundUser?.user_id,
          },
        );
      }

      return { user: foundUser };
    });

    res.status(200).json({ is2FAEnabled: !!user.totp_enabled_on });
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      logError(error);
      next(new ErrorWithStatus(500, 'authentication_error', 'Incorrect username or password'));
    }
  }
};

export const generateNewAccessToken = async (
  _: Request,
  res: TypedResponse<typeof refreshTokenSchema>,
  next: NextFunction,
) => {
  const { refreshToken } = res.locals.input.body;

  try {
    const { userId, tokenVersion } = getTokenClaims(
      jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET, {
        algorithms: [jwtConstants.ALGORITHM],
        audience: jwtConstants.AUDIENCE,
        issuer: jwtConstants.ISSUER,
      }),
    );

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
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(
        new SecurityErrorWithStatus(401, 'jwt_refresh_error', error.message, {
          operation: 'refresh_token',
          reason: error instanceof jwt.TokenExpiredError ? 'expired_token' : 'invalid_token',
        }),
      );
    } else {
      logError(error);
      next(
        new ErrorWithStatus(
          500,
          'jwt_refresh_error',
          error instanceof Error
            ? error.message
            : 'Unknown error while trying to refresh access token',
        ),
      );
    }
  }
};

export const revokeSessions = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
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
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'authentication_error', 'Unknown error while signing out'));
  }
};

export const passwordStrength = (
  _: Request,
  res: TypedResponse<typeof passwordStrengthSchema>,
  next: NextFunction,
) => {
  const { password } = res.locals.input.body;

  try {
    const { isStrong, score, error } = getPasswordStrength({ password });
    if (!isStrong) {
      res.status(200).json(success([{ message: error, score }]));
      return;
    }
    res.status(200).json(success([{ message: 'Password is strong', score }]));
  } catch (error) {
    logError(error);
    next(
      new ErrorWithStatus(500, 'password_strength_error', 'Unknown error while checking password'),
    );
  }
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

export const resetPassword = async (
  _: Request,
  res: TypedResponse<typeof resetPasswordSchema>,
  next: NextFunction,
) => {
  const { email, newPassword, otp, twoFactorCode } = res.locals.input.body;

  try {
    await db.tx('resetPassword', async (t) => {
      // Locked so a code can be used only once.
      const user = await findUserByEmailForUpdate(t, email);
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
          throw new SecurityErrorWithStatus(
            422,
            'reset_password_error',
            'Two-factor code required',
            { operation: 'password_reset', reason: 'otp_required', targetUserId: user.user_id },
          );
        }

        const twoFactorVerification = await findVerification(t, {
          userId: user.user_id,
          type: '2fa',
        });
        if (
          !twoFactorVerification ||
          !validateTOTP({ otp: twoFactorCode, ...twoFactorVerification })
        ) {
          throw new SecurityErrorWithStatus(
            422,
            'reset_password_error',
            'Incorrect two-factor code',
            { operation: 'password_reset', reason: 'invalid_otp', targetUserId: user.user_id },
          );
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

      await updatePassword(t, { userId: user.user_id, newPassword });
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
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      logError(error);
      next(
        new ErrorWithStatus(
          500,
          'forget_password_error',
          'Unknown error while trying to reset password',
        ),
      );
    }
  }
};

export const generate2FAUrl = async (_req: Request, res: TypedResponse, next: NextFunction) => {
  const userId = res.locals.userId;

  try {
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
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      logError(error);
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't generate url"));
    }
  }
};

export const enable2FA = async (
  _: Request,
  res: TypedResponse<typeof enable2FASchema>,
  next: NextFunction,
) => {
  const { twoFactorCode } = res.locals.input.body;
  const userId = res.locals.userId;

  try {
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
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      logError(error);
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't enable 2FA"));
    }
  }
};

export const disable2FA = async (
  _: Request,
  res: TypedResponse<typeof enable2FASchema>,
  next: NextFunction,
) => {
  const { twoFactorCode } = res.locals.input.body;
  const userId = res.locals.userId;

  try {
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
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      logError(error);
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't disable 2FA"));
    }
  }
};
