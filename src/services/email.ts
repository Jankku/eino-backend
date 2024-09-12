import { NextFunction, Request, Response } from 'express';
import { success } from '../util/response';
import { ErrorWithStatus } from '../util/errorhandler';
import { generateTOTP, validateEmailOTP, validateTOTP } from '../util/totp';
import {
  addVerification,
  deleteVerification,
  findVerification,
  getVerification,
} from '../db/verification';
import Logger from '../util/logger';
import {
  getUserByUsername,
  isEmailAlreadyUsed,
  isEmailVerified,
  updateEmailAddress,
  updateEmailVerifiedTimestamp,
} from '../db/users';
import { TypedRequest } from '../util/zod';
import { updateEmailSchema, verifyEmailSchema } from '../routes/email';
import { DateTime } from 'luxon';
import { isVerificationExpired } from '../util/verification';
import { sendEmail } from '../util/email';
import { confirmEmailTemplate } from '../util/emailtemplates';
import { db } from '../db/config';

export const updateEmail = async (
  req: TypedRequest<typeof updateEmailSchema>,
  res: Response,
  next: NextFunction,
) => {
  const username: string = res.locals.username;
  const { email, twoFactorCode } = req.body;
  try {
    await db.tx('updateEmail', async (t) => {
      const user = await getUserByUsername(t, username);

      if (user.totp_enabled_on) {
        if (!twoFactorCode) {
          throw new ErrorWithStatus(422, 'update_email_error', 'Two-factor code required');
        }

        const twoFactorVerification = await getVerification(t, {
          target: user.username,
          type: '2fa',
        });
        if (!validateTOTP({ otp: twoFactorCode, ...twoFactorVerification })) {
          throw new ErrorWithStatus(422, 'update_email_error', 'Incorrect two-factor code');
        }
      }

      if (!email) {
        await updateEmailAddress(t, { username, email: undefined });
        res
          .status(200)
          .json(success([{ name: 'email_removed', message: 'Email successfully removed' }]));
        return;
      }

      const isEmailUsed = await isEmailAlreadyUsed(t, { username, email });
      if (isEmailUsed) {
        throw new ErrorWithStatus(422, 'email_already_used', 'Email is already in use');
      }

      const isVerified = await isEmailVerified(t, email);
      if (isVerified) {
        res
          .status(200)
          .json(
            success([{ name: 'email_already_verified', message: 'Email is already verified' }]),
          );
        return;
      }

      const verification = await findVerification(t, { target: email, type: 'email' });
      if (verification) {
        await deleteVerification(t, { target: email, type: 'email' });
      }

      await updateEmailAddress(t, { username, email });
    });

    res.status(200).json(success([{ name: 'email_updated', message: 'Email updated' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(422, 'update_email_error', "Couldn't update email"));
    }
  }
};

export const sendConfirmationEmail = async (req: Request, res: Response, next: NextFunction) => {
  const username: string = res.locals.username;

  try {
    await db.tx('sendConfirmationEmail', async (t) => {
      const user = await getUserByUsername(t, username);

      if (!user.email) {
        throw new ErrorWithStatus(422, 'email_error', "Couldn't send confirmation email");
      }

      const isVerified = await isEmailVerified(t, user.email);
      if (isVerified) {
        throw new ErrorWithStatus(422, 'email_already_verified', 'Email already verified');
      }

      const totp = await generateTOTP({
        label: user.email,
        period: 60 * 15, // 15 minutes
      });

      await addVerification(t, {
        ...totp,
        type: 'email',
        target: totp.label,
        expires_on: DateTime.now().plus({ minutes: 15 }).toJSDate(),
      });

      const emailResponse = await sendEmail({
        recipient: user.email,
        template: confirmEmailTemplate(totp.otp),
      });

      if (!emailResponse.success) {
        throw new ErrorWithStatus(424, 'email_error', "Couldn't send confirmation email");
      }
    });

    res
      .status(200)
      .json(
        success([
          { name: 'email_pending_verification', message: 'Verification code sent to email' },
        ]),
      );
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(422, 'email_error', "Couldn't send confirmation email"));
    }
  }
};

export const verifyEmail = async (
  req: TypedRequest<typeof verifyEmailSchema>,
  res: Response,
  next: NextFunction,
) => {
  const username: string = res.locals.username;
  const { otp } = req.body;

  try {
    await db.tx('verifyEmail', async (t) => {
      const user = await getUserByUsername(t, username);

      if (!user.email) {
        throw new ErrorWithStatus(422, 'email_verification_error', "Couldn't verify email");
      }

      const verification = await getVerification(t, { target: user.email, type: 'email' });

      if (verification.expires_on && isVerificationExpired(verification.expires_on)) {
        await deleteVerification(t, { target: user.email, type: 'email' });
        throw new ErrorWithStatus(422, 'email_verification_expired', 'Verification expired');
      }

      if (!validateEmailOTP({ otp, ...verification })) {
        throw new ErrorWithStatus(422, 'email_verification_error', 'Invalid one-time password');
      }

      await deleteVerification(t, { target: user.email, type: 'email' });

      await updateEmailVerifiedTimestamp(t, user.email);
    });

    res
      .status(200)
      .json(success([{ name: 'email_verified', message: 'Email successfully verified' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(422, 'email_verification_error', "Couldn't verify email"));
    }
  }
};
