import * as bcrypt from 'bcrypt';
import { NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import {
  disableTOTP,
  enableTOTP,
  findUserByCredential,
  findUserByEmail,
  findUserById,
  getUserById,
  updateLastLogin,
  updatePassword,
} from '../db/users';
import { db } from '../db/config';
import { success } from '../util/response';
import { Logger } from '../util/logger';
import {
  generateAccessToken,
  generatePasswordHash,
  generateRefreshToken,
  getPasswordStrength,
  getTokenSubject,
} from '../util/auth';
import { ErrorWithStatus, SecurityErrorWithStatus } from '../util/errorhandler';
import { config } from '../config';
import { TypedResponse } from '../util/zod';
import {
  enable2FASchema,
  forgotPasswordSchema,
  loginConfigSchema,
  loginSchema,
  passwordStrengthSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from '../routes/auth';
import { addVerification, deleteVerification, findVerification } from '../db/verification';
import { generateTOTP, validateTOTP } from '../util/totp';
import QRCode from 'qrcode';
import { DateTime } from 'luxon';
import { isVerificationExpired } from '../util/verification';
import { sendEmail } from '../util/email';
import { resetPasswordTemplate } from '../util/emailtemplates';
import { addAudit } from '../db/audit';
import { getDefaultRoleId } from '../db/role';
import { jwtConstants } from '../util/jwtconstants';

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
    Logger.error((error as Error).stack);
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
    const { user } = await db.tx('login', async (t) => {
      const user = await findUserByCredential(t, usernameOrEmail);
      if (!user) {
        throw new SecurityErrorWithStatus(
          422,
          'authentication_error',
          'Incorrect username or password',
          { operation: 'login', reason: 'invalid_credentials' },
        );
      }

      if (user.disabled_on) {
        throw new SecurityErrorWithStatus(422, 'authentication_error', 'Account disabled', {
          operation: 'login',
          reason: 'account_disabled',
          targetUserId: user.user_id,
        });
      }

      const isCorrect = await bcrypt.compare(password, user.password);
      if (!isCorrect) {
        throw new SecurityErrorWithStatus(
          422,
          'authentication_error',
          'Incorrect username or password',
          { operation: 'login', reason: 'invalid_credentials', targetUserId: user.user_id },
        );
      }

      if (user.totp_enabled_on) {
        if (!twoFactorCode) {
          throw new SecurityErrorWithStatus(
            422,
            'authentication_error',
            'One-time password required',
            { operation: 'login', reason: 'otp_required', targetUserId: user.user_id },
          );
        }

        const verification = await findVerification(t, { target: user.username, type: '2fa' });
        if (!verification || !validateTOTP({ otp: twoFactorCode, ...verification })) {
          throw new SecurityErrorWithStatus(
            422,
            'authentication_error',
            'Incorrect one-time password',
            { operation: 'login', reason: 'invalid_otp', targetUserId: user.user_id },
          );
        }
      }

      await updateLastLogin(t, user.user_id);
      await addAudit(t, { actor_user_id: user.user_id, username: user.username, action: 'login' });

      return { user };
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({ accessToken, refreshToken });
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
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
      const user = await findUserByCredential(t, usernameOrEmail);
      if (!user) {
        throw new SecurityErrorWithStatus(
          422,
          'authentication_error',
          'Incorrect username or password',
          { operation: 'login_config', reason: 'invalid_credentials' },
        );
      }

      if (user.disabled_on) {
        throw new SecurityErrorWithStatus(422, 'authentication_error', 'Account disabled', {
          operation: 'login_config',
          reason: 'account_disabled',
          targetUserId: user.user_id,
        });
      }

      const isCorrect = await bcrypt.compare(password, user.password);
      if (!isCorrect) {
        throw new SecurityErrorWithStatus(
          422,
          'authentication_error',
          'Incorrect username or password',
          { operation: 'login_config', reason: 'invalid_credentials', targetUserId: user.user_id },
        );
      }

      return { user };
    });

    res.status(200).json({
      is2FAEnabled: user.totp_enabled_on ? true : false,
    });
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
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
    const userId = getTokenSubject(
      jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET, {
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
      const accessToken = generateAccessToken(user);
      await updateLastLogin(t, user.user_id);
      await addAudit(t, {
        actor_user_id: user.user_id,
        username: user.username,
        action: 'access_token_refresh',
      });
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
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(500, 'jwt_refresh_error', (error as Error)?.message));
    }
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
    Logger.error((error as Error).stack);
    next(
      new ErrorWithStatus(500, 'password_strength_error', 'Unknown error while checking password'),
    );
  }
};

export const forgotPassword = async (
  _: Request,
  res: TypedResponse<typeof forgotPasswordSchema>,
  next: NextFunction,
) => {
  const { email } = res.locals.input.body;

  try {
    const { user, otp } = await db.tx('forgotPassword', async (t) => {
      const user = await findUserByEmail(t, email);
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

      const verification = await findVerification(t, { target: email, type: 'password_reset' });
      if (verification) {
        await deleteVerification(t, { target: email, type: 'password_reset' });
      }

      const { otp, secret, algorithm, digits, period } = await generateTOTP({ label: email });

      await addVerification(t, {
        type: 'password_reset',
        target: email,
        secret,
        algorithm,
        digits,
        period,
        expires_on: DateTime.now().plus({ minutes: 15 }).toJSDate(),
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
      next(
        new SecurityErrorWithStatus(
          424,
          'forget_password_error',
          "Couldn't send password reset email",
          {
            operation: 'password_forgot',
            reason: 'email_delivery_failed',
            targetUserId: user.user_id,
          },
        ),
      );
      return;
    }

    res.status(200).json(
      success([
        {
          name: 'password_reset_email_sent',
          message: 'Check your email for one-time password',
          is2FAEnabled: user.totp_enabled_on ? true : false,
        },
      ]),
    );
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
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

export const resetPassword = async (
  _: Request,
  res: TypedResponse<typeof resetPasswordSchema>,
  next: NextFunction,
) => {
  const { email, newPassword, otp, twoFactorCode } = res.locals.input.body;

  try {
    await db.tx('resetPassword', async (t) => {
      const user = await findUserByEmail(t, email);
      if (!user) {
        throw new SecurityErrorWithStatus(422, 'reset_password_error', 'Account not found', {
          operation: 'password_reset',
          reason: 'account_not_found',
        });
      }

      if (user.disabled_on) {
        throw new SecurityErrorWithStatus(422, 'reset_password_error', 'Account disabled', {
          operation: 'password_reset',
          reason: 'account_disabled',
          targetUserId: user.user_id,
        });
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
          target: user.username,
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

      const verification = await findVerification(t, { target: email, type: 'password_reset' });
      if (!verification) {
        throw new SecurityErrorWithStatus(
          422,
          'reset_password_error',
          'Invalid one-time password',
          {
            operation: 'password_reset',
            reason: 'verification_missing',
            targetUserId: user.user_id,
          },
        );
      }

      if (verification.expires_on && isVerificationExpired(verification.expires_on)) {
        await deleteVerification(t, { target: email, type: 'email' });
        throw new SecurityErrorWithStatus(422, 'reset_password_error', 'Verification expired', {
          operation: 'password_reset',
          reason: 'verification_expired',
          targetUserId: user.user_id,
        });
      }

      if (!validateTOTP({ otp, ...verification })) {
        throw new SecurityErrorWithStatus(
          422,
          'reset_password_error',
          'Incorrect one-time password',
          { operation: 'password_reset', reason: 'invalid_otp', targetUserId: user.user_id },
        );
      }

      await updatePassword(t, { email, newPassword });
      await deleteVerification(t, { target: email, type: 'password_reset' });
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
      Logger.error((error as Error).stack);
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

export const generate2FAUrl = async (req: Request, res: TypedResponse, next: NextFunction) => {
  const userId = res.locals.userId;

  try {
    const { totpUrl } = await db.tx('generate2FAUrl', async (t) => {
      const user = await getUserById(t, userId);

      if (user.totp_enabled_on) {
        throw new ErrorWithStatus(422, '2fa_error', '2FA already enabled');
      }

      const verification = await findVerification(t, { target: user.username, type: '2fa' });
      if (verification) {
        await deleteVerification(t, { target: user.username, type: '2fa' });
      }

      const { totpUrl, secret, digits, period, algorithm, label } = await generateTOTP({
        label: user.username,
      });

      await addVerification(t, {
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
      Logger.error((error as Error).stack);
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
    await db.tx('enable2FA', async (t) => {
      const user = await getUserById(t, userId);

      if (user.totp_enabled_on) {
        throw new ErrorWithStatus(422, '2fa_error', '2FA already enabled');
      }

      const verification = await findVerification(t, { target: user.username, type: '2fa' });
      if (!verification || !validateTOTP({ otp: twoFactorCode, ...verification })) {
        throw new SecurityErrorWithStatus(422, '2fa_error', 'Incorrect two-factor code', {
          operation: 'two_factor_enable',
          reason: 'invalid_otp',
          targetUserId: user.user_id,
        });
      }

      await enableTOTP(t, user.user_id);
      await addAudit(t, {
        actor_user_id: user.user_id,
        username: user.username,
        action: 'two_factor_authentication_enabled',
      });
    });

    res.status(200).json(success([{ name: '2fa_enabled', message: '2FA enabled' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
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
    await db.tx('disable2FA', async (t) => {
      const user = await getUserById(t, userId);

      if (!user.totp_enabled_on) {
        throw new ErrorWithStatus(422, '2fa_error', '2FA not enabled');
      }

      const verification = await findVerification(t, { target: user.username, type: '2fa' });
      if (!verification || !validateTOTP({ otp: twoFactorCode, ...verification })) {
        throw new SecurityErrorWithStatus(422, '2fa_error', 'Incorrect two-factor code', {
          operation: 'two_factor_disable',
          reason: 'invalid_otp',
          targetUserId: user.user_id,
        });
      }

      await deleteVerification(t, { target: user.username, type: '2fa' });
      await disableTOTP(t, user.user_id);
      await addAudit(t, {
        actor_user_id: user.user_id,
        username: user.username,
        action: 'two_factor_authentication_disabled',
      });
    });

    res.status(200).json(success([{ name: '2fa_disabled', message: '2FA disabled' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't disable 2FA"));
    }
  }
};
