import * as bcrypt from 'bcrypt';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  disableTOTP,
  enableTOTP,
  getUserByCredential,
  getUserByEmail,
  getUserByUsername,
  updatePassword,
} from '../db/users';
import { db } from '../db/config';
import { success } from '../util/response';
import Logger from '../util/logger';
import {
  generateAccessToken,
  generatePasswordHash,
  generateRefreshToken,
  getPasswordStrength,
  updateLastLogin,
} from '../util/auth';
import { ErrorWithStatus } from '../util/errorhandler';
import { config } from '../config';
import { TypedRequest } from '../util/zod';
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
import { addVerification, deleteVerification, getVerification } from '../db/verification';
import { generateTOTP, validateTOTP } from '../util/totp';
import QRCode from 'qrcode';
import { JwtPayload } from '../middleware/verifytoken';
import { DateTime } from 'luxon';
import { isVerificationExpired } from '../util/verification';
import { sendEmail } from '../util/email';
import { resetPasswordTemplate } from '../util/emailtemplates';

const register = async (
  req: TypedRequest<typeof registerSchema>,
  res: Response,
  next: NextFunction,
) => {
  const { username, password, email } = req.body;

  try {
    const hashedPassword = await generatePasswordHash(password);
    await db.none({
      text: `INSERT INTO users (username, password, email)
             VALUES ($1, $2, $3)`,
      values: [username, hashedPassword, email],
    });

    if (email) {
      const totp = await generateTOTP({ label: email, period: 0 });
      await addVerification({
        ...totp,
        type: 'email',
        target: totp.label,
      });
    }

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

const login = async (req: TypedRequest<typeof loginSchema>, res: Response, next: NextFunction) => {
  const { username: usernameOrEmail, password, otp } = req.body;

  try {
    const user = await getUserByCredential(usernameOrEmail);
    if (!user) {
      next(new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password'));
      return;
    }

    const isCorrect = await bcrypt.compare(password, user.password);
    if (!isCorrect) {
      next(new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password'));
      return;
    }

    if (user.totp_enabled_on) {
      if (!otp) {
        next(new ErrorWithStatus(422, 'authentication_error', 'One-time password required'));
        return;
      }

      const verification = await getVerification({ target: user.username, type: '2fa' });
      if (!verification) {
        next(new ErrorWithStatus(422, 'authentication_error', "Couldn't verify One-time password"));
        return;
      }

      if (!validateTOTP({ otp, ...verification })) {
        next(new ErrorWithStatus(422, 'authentication_error', "Couldn't verify One-time password"));
        return;
      }
    }

    await updateLastLogin(user.user_id);

    const accessToken = generateAccessToken(user.user_id, user.username);
    const refreshToken = generateRefreshToken(user.user_id, user.username);

    return res.status(200).json({ accessToken, refreshToken });
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'authentication_error', 'Incorrect username or password'));
  }
};

const loginConfig = async (
  req: TypedRequest<typeof loginConfigSchema>,
  res: Response,
  next: NextFunction,
) => {
  const { username: usernameOrEmail, password } = req.body;

  try {
    const user = await getUserByCredential(usernameOrEmail);
    if (!user) {
      next(new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password'));
      return;
    }

    const isCorrect = await bcrypt.compare(password, user.password);
    if (!isCorrect) {
      next(new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password'));
      return;
    }

    return res.status(200).json({
      requireOtp: user.totp_enabled_on ? true : false,
    });
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'authentication_error', 'Unknown error while trying to login'));
  }
};

const generateNewAccessToken = (
  req: TypedRequest<typeof refreshTokenSchema>,
  res: Response,
  next: NextFunction,
) => {
  const { refreshToken } = req.body;

  try {
    const { userId, username } = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET, {
      audience: 'eino',
      issuer: 'eino-backend',
    }) as JwtPayload;

    const newAccessToken = generateAccessToken(userId, username);
    return res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    next(new ErrorWithStatus(422, 'jwt_refresh_error', (error as Error)?.message));
  }
};

const passwordStrength = (
  req: TypedRequest<typeof passwordStrengthSchema>,
  res: Response,
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

const forgotPassword = async (
  req: TypedRequest<typeof forgotPasswordSchema>,
  res: Response,
  next: NextFunction,
) => {
  const { email } = req.body;

  try {
    const user = await getUserByEmail(email);
    if (!user || !user.email) {
      next(new ErrorWithStatus(422, 'forget_password_error', 'Account not found'));
      return;
    }

    if (!user.email_verified_on) {
      next(new ErrorWithStatus(422, 'forget_password_error', 'Email not verified'));
      return;
    }

    const verification = await getVerification({ target: email, type: 'password_reset' });
    if (verification) {
      await deleteVerification({ target: email, type: 'password_reset' });
    }

    const { otp, secret, algorithm, digits, period } = await generateTOTP({ label: email });

    await addVerification({
      type: 'password_reset',
      target: email,
      secret,
      algorithm,
      digits,
      period,
      expires_on: DateTime.now().plus({ minutes: 30 }).toJSDate(),
    });

    const emailResponse = await sendEmail({
      recipient: user.email,
      template: resetPasswordTemplate(otp),
    });

    if (!emailResponse.success) {
      next(new ErrorWithStatus(424, 'forget_password_error', "Couldn't send password reset email"));
      return;
    }

    res
      .status(200)
      .json(
        success([
          { name: 'password_reset_email_sent', message: 'Check your email for one-time password' },
        ]),
      );
  } catch (error) {
    Logger.error((error as Error).stack);
    next(
      new ErrorWithStatus(
        500,
        'forget_password_error',
        'Unknown error while trying to reset password',
      ),
    );
  }
};

const resetPassword = async (
  req: TypedRequest<typeof resetPasswordSchema>,
  res: Response,
  next: NextFunction,
) => {
  const { email, newPassword, otp } = req.body;

  try {
    const { isStrong, error } = getPasswordStrength({ password: newPassword });
    if (!isStrong) {
      next(new ErrorWithStatus(422, 'reset_password_error', error));
      return;
    }

    const verification = await getVerification({ target: email, type: 'password_reset' });
    if (!verification) {
      next(new ErrorWithStatus(422, 'reset_password_error', 'No reset password request found'));
      return;
    }

    if (verification.expires_on && isVerificationExpired(verification.expires_on)) {
      await deleteVerification({ target: email, type: 'email' });
      next(new ErrorWithStatus(422, 'reset_password_error', 'Verification expired'));
      return;
    }

    if (!validateTOTP({ otp, ...verification })) {
      next(new ErrorWithStatus(422, 'reset_password_error', 'Incorrect one-time password'));
      return;
    }

    await updatePassword({ email, newPassword });
    await deleteVerification({ target: email, type: 'password_reset' });

    res
      .status(200)
      .json(success([{ name: 'password_reset_successful', message: 'Password reset successful' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(
      new ErrorWithStatus(
        500,
        'forget_password_error',
        'Unknown error while trying to reset password',
      ),
    );
  }
};

const generate2FAUrl = async (req: Request, res: Response, next: NextFunction) => {
  const username: string = res.locals.username;

  try {
    const user = await getUserByUsername(username);
    if (!user) {
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't generate url"));
      return;
    }

    if (user.totp_enabled_on) {
      next(new ErrorWithStatus(422, '2fa_error', '2FA already enabled'));
      return;
    }

    const verification = await getVerification({ target: user.username, type: '2fa' });
    if (verification) {
      await deleteVerification({ target: user.username, type: '2fa' });
    }

    const { totpUrl, secret, digits, period, algorithm, label } = await generateTOTP({
      label: user.username,
    });

    await addVerification({
      type: '2fa',
      target: label,
      secret,
      algorithm,
      digits,
      period,
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
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, '2fa_error', "Couldn't generate url"));
  }
};

const enable2FA = async (
  req: TypedRequest<typeof enable2FASchema>,
  res: Response,
  next: NextFunction,
) => {
  const { otp } = req.body;
  const username: string = res.locals.username;

  try {
    const user = await getUserByUsername(username);
    if (!user) {
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't enable 2FA"));
      return;
    }

    if (user.totp_enabled_on) {
      next(new ErrorWithStatus(422, '2fa_error', '2FA already enabled'));
      return;
    }

    const verification = await getVerification({ target: user.username, type: '2fa' });
    if (!verification) {
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't enable 2FA"));
      return;
    }

    if (!validateTOTP({ otp, ...verification })) {
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't enable 2FA"));
      return;
    }

    await enableTOTP(user.username);

    res.status(200).json(success([{ name: '2fa_enabled', message: '2FA enabled' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, '2fa_error', "Couldn't enable 2FA"));
  }
};

const disable2FA = async (
  req: TypedRequest<typeof enable2FASchema>,
  res: Response,
  next: NextFunction,
) => {
  const { otp } = req.body;
  const username: string = res.locals.username;

  try {
    const user = await getUserByUsername(username);
    if (!user) {
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't disable 2FA"));
      return;
    }

    if (!user.totp_enabled_on) {
      next(new ErrorWithStatus(422, '2fa_error', '2FA not enabled'));
      return;
    }

    const verification = await getVerification({ target: user.username, type: '2fa' });
    if (!verification) {
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't disable 2FA"));
      return;
    }

    if (!validateTOTP({ otp, ...verification })) {
      next(new ErrorWithStatus(422, '2fa_error', "Couldn't disable 2FA"));
      return;
    }

    await deleteVerification({ target: user.username, type: '2fa' });
    await disableTOTP(user.username);

    res.status(200).json(success([{ name: '2fa_disabled', message: '2FA disabled' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, '2fa_error', "Couldn't disable 2FA"));
  }
};

export {
  register,
  login,
  loginConfig,
  generateNewAccessToken,
  passwordStrength,
  forgotPassword,
  resetPassword,
  generate2FAUrl,
  enable2FA,
  disable2FA,
};
