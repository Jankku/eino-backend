import * as bcrypt from 'bcrypt';
import { NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import {
  disableTOTP,
  enableTOTP,
  findUserByCredential,
  findUserByEmail,
  getUserByEmail,
  getUserByUsername,
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
} from '../util/auth';
import { ErrorWithStatus } from '../util/errorhandler';
import { config } from '../config';
import { TypedRequest, TypedResponse } from '../util/zod';
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
import {
  addVerification,
  deleteVerification,
  findVerification,
  getVerification,
} from '../db/verification';
import { generateTOTP, validateTOTP } from '../util/totp';
import QRCode from 'qrcode';
import { JwtPayload } from '../middleware/verifytoken';
import { DateTime } from 'luxon';
import { isVerificationExpired } from '../util/verification';
import { sendEmail } from '../util/email';
import { resetPasswordTemplate } from '../util/emailtemplates';
import { addAudit } from '../db/audit';
import { getDefaultRoleId } from '../db/role';

export const register = async (
  req: TypedRequest<typeof registerSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { username, password, email } = req.body;

  try {
    await db.task('register', async (t) => {
      const hashedPassword = await generatePasswordHash(password);
      const defaultRoleId = getDefaultRoleId();
      await t.none({
        text: `INSERT INTO users (username, password, email, role_id)
             VALUES ($1, $2, $3, $4)`,
        values: [username, hashedPassword, email || undefined, defaultRoleId],
      });
      await addAudit(t, { username, action: 'register' });
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
  req: TypedRequest<typeof loginSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { username: usernameOrEmail, password, twoFactorCode } = req.body;

  try {
    const { user } = await db.tx('login', async (t) => {
      const user = await findUserByCredential(t, usernameOrEmail);
      if (!user) {
        throw new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password');
      }

      if (user.disabled_on) {
        throw new ErrorWithStatus(422, 'authentication_error', 'Account disabled');
      }

      const isCorrect = await bcrypt.compare(password, user.password);
      if (!isCorrect) {
        throw new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password');
      }

      if (user.totp_enabled_on) {
        if (!twoFactorCode) {
          throw new ErrorWithStatus(422, 'authentication_error', 'One-time password required');
        }

        const verification = await getVerification(t, { target: user.username, type: '2fa' });
        if (!validateTOTP({ otp: twoFactorCode, ...verification })) {
          throw new ErrorWithStatus(422, 'authentication_error', 'Incorrect one-time password');
        }
      }

      await updateLastLogin(t, user.user_id);
      await addAudit(t, { username: user.username, action: 'login' });

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
  req: TypedRequest<typeof loginConfigSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { username: usernameOrEmail, password } = req.body;

  try {
    const { user } = await db.tx('loginConfig', async (t) => {
      const user = await findUserByCredential(t, usernameOrEmail);
      if (!user) {
        throw new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password');
      }

      if (user.disabled_on) {
        throw new ErrorWithStatus(422, 'authentication_error', 'Account disabled');
      }

      const isCorrect = await bcrypt.compare(password, user.password);
      if (!isCorrect) {
        throw new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password');
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
  req: TypedRequest<typeof refreshTokenSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { refreshToken } = req.body;

  try {
    const { username } = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET, {
      audience: 'eino',
      issuer: 'eino-backend',
    }) as JwtPayload;

    const accessToken = await db.task('generateNewAccessToken', async (t) => {
      const user = await getUserByUsername(t, username);
      if (user.disabled_on) {
        throw new ErrorWithStatus(422, 'authentication_error', 'Account disabled');
      }
      const accessToken = generateAccessToken(user);
      await addAudit(t, { username: user.username, action: 'access_token_refresh' });
      return accessToken;
    });

    res.status(200).json({ accessToken });
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      next(new ErrorWithStatus(422, 'jwt_refresh_error', (error as Error)?.message));
    }
  }
};

export const passwordStrength = (
  req: TypedRequest<typeof passwordStrengthSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { password } = req.body;

  try {
    const { isStrong, score, error } = getPasswordStrength({ password });
    if (!isStrong) {
      res.status(200).json(success([{ message: error, score }]));
      return;
    }

    res.status(200).json(success([{ message: 'Password is strong', score }]));
  } catch {
    next(
      new ErrorWithStatus(500, 'password_strength_error', 'Unknown error while checking password'),
    );
  }
};

export const forgotPassword = async (
  req: TypedRequest<typeof forgotPasswordSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { email } = req.body;

  try {
    const { user, otp } = await db.tx('forgotPassword', async (t) => {
      const user = await findUserByEmail(t, email);
      if (!user || !user.email) {
        throw new ErrorWithStatus(422, 'forget_password_error', 'Account not found');
      }

      if (user.disabled_on) {
        throw new ErrorWithStatus(422, 'forget_password_error', 'Account disabled');
      }

      if (!user.email_verified_on) {
        throw new ErrorWithStatus(422, 'forget_password_error', 'Email not verified');
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
          username: user.username,
          action: 'password_forgot',
          new_data: { email, email_sent: emailResponse.success },
        }),
    );

    if (!emailResponse.success) {
      next(new ErrorWithStatus(424, 'forget_password_error', "Couldn't send password reset email"));
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
  req: TypedRequest<typeof resetPasswordSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { email, newPassword, otp, twoFactorCode } = req.body;

  try {
    await db.tx('resetPassword', async (t) => {
      const user = await getUserByEmail(t, email);

      if (user.disabled_on) {
        throw new ErrorWithStatus(422, 'reset_password_error', 'Account disabled');
      }

      if (user.totp_enabled_on) {
        if (!twoFactorCode) {
          throw new ErrorWithStatus(422, 'reset_password_error', 'Two-factor code required');
        }

        const twoFactorVerification = await getVerification(t, {
          target: user.username,
          type: '2fa',
        });
        if (!validateTOTP({ otp: twoFactorCode, ...twoFactorVerification })) {
          throw new ErrorWithStatus(422, 'reset_password_error', 'Incorrect two-factor code');
        }
      }

      const { isStrong, error } = getPasswordStrength({ password: newPassword });
      if (!isStrong) {
        throw new ErrorWithStatus(422, 'reset_password_error', error);
      }

      const verification = await getVerification(t, { target: email, type: 'password_reset' });

      if (verification.expires_on && isVerificationExpired(verification.expires_on)) {
        await deleteVerification(t, { target: email, type: 'email' });
        throw new ErrorWithStatus(422, 'reset_password_error', 'Verification expired');
      }

      if (!validateTOTP({ otp, ...verification })) {
        throw new ErrorWithStatus(422, 'reset_password_error', 'Incorrect one-time password');
      }

      await updatePassword(t, { email, newPassword });
      await deleteVerification(t, { target: email, type: 'password_reset' });
      await addAudit(t, { username: user.username, action: 'password_reseted' });
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
  const username: string = res.locals.username;

  try {
    const { totpUrl } = await db.tx('generate2FAUrl', async (t) => {
      const user = await getUserByUsername(t, username);

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

      return { totpUrl };
    });

    const qrCodeUrl = await QRCode.toDataURL(totpUrl);

    res.status(200).json(
      success([
        {
          totpUrl,
          qrCodeUrl,
        },
      ]),
    );
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
  req: TypedRequest<typeof enable2FASchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { twoFactorCode } = req.body;
  const username: string = res.locals.username;

  try {
    await db.tx('enable2FA', async (t) => {
      const user = await getUserByUsername(t, username);

      if (user.totp_enabled_on) {
        throw new ErrorWithStatus(422, '2fa_error', '2FA already enabled');
      }

      const verification = await getVerification(t, { target: user.username, type: '2fa' });
      if (!validateTOTP({ otp: twoFactorCode, ...verification })) {
        throw new ErrorWithStatus(422, '2fa_error', 'Incorrect two-factor code');
      }

      await enableTOTP(t, user.username);
      await addAudit(t, { username: user.username, action: 'two_factor_authentication_enabled' });
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
  req: TypedRequest<typeof enable2FASchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { twoFactorCode } = req.body;
  const username: string = res.locals.username;

  try {
    await db.tx('disable2FA', async (t) => {
      const user = await getUserByUsername(t, username);

      if (!user.totp_enabled_on) {
        throw new ErrorWithStatus(422, '2fa_error', '2FA not enabled');
      }

      const verification = await getVerification(t, { target: user.username, type: '2fa' });
      if (!validateTOTP({ otp: twoFactorCode, ...verification })) {
        throw new ErrorWithStatus(422, '2fa_error', 'Incorrect two-factor code');
      }

      await deleteVerification(t, { target: user.username, type: '2fa' });
      await disableTOTP(t, user.username);
      await addAudit(t, { username: user.username, action: 'two_factor_authentication_disabled' });
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
