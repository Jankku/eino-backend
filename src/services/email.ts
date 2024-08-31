import { NextFunction, Request, Response } from 'express';
import { success } from '../util/response';
import { ErrorWithStatus } from '../util/errorhandler';
import { generateTOTP, validateTOTP } from '../util/totp';
import { addVerification, deleteVerification, getVerification } from '../db/verification';
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
import { config } from '../config';
import { DateTime } from 'luxon';
import { isVerificationExpired } from '../util/verification';

const updateEmail = async (
  req: TypedRequest<typeof updateEmailSchema>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const username: string = res.locals.username;
    const { email } = req.body;

    if (!email) {
      await updateEmailAddress({ username, email: null });
      res
        .status(200)
        .json(success([{ name: 'email_removed', message: 'Email successfully removed' }]));
      return;
    }

    const isEmailUsed = await isEmailAlreadyUsed({ username, email });
    if (isEmailUsed) {
      next(new ErrorWithStatus(422, 'email_error', 'Email already in use'));
      return;
    }

    const isVerified = await isEmailVerified(email);
    if (isVerified) {
      res
        .status(200)
        .json(success([{ name: 'email_already_verified', message: 'Email is already verified' }]));
      return;
    }

    const verification = await getVerification({ target: email, type: 'email' });
    if (verification) {
      if (verification.expires_on && isVerificationExpired(verification.expires_on)) {
        await deleteVerification({ target: email, type: 'email' });
      } else {
        next(new ErrorWithStatus(422, 'email_error', 'Verification already pending'));
        return;
      }
    }

    await updateEmailAddress({ username, email });

    const totp = await generateTOTP({ label: email });

    await addVerification({
      ...totp,
      type: 'email',
      target: totp.label,
      period: 0,
      expires_on: DateTime.now().plus({ minutes: 30 }).toJSDate(),
    });

    res.status(200).json(success([{ name: 'email_updated', message: 'Email updated' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'email_error', "Couldn't update email"));
  }
};

const sendConfirmationEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const username: string = res.locals.username;

    const user = await getUserByUsername(username);
    if (!user || !user.email) {
      next(new ErrorWithStatus(422, 'email_error', "Couldn't send confirmation email"));
      return;
    }

    const isVerified = await isEmailVerified(user.email);
    if (isVerified) {
      next(new ErrorWithStatus(422, 'email_error', 'Email already verified'));
      return;
    }

    const verification = await getVerification({ target: user.email, type: 'email' });
    if (!verification) {
      next(new ErrorWithStatus(422, 'email_error', "Couldn't send confirmation email"));
      return;
    }

    const { otp } = await generateTOTP({ ...verification, label: user.email });

    if (config.isProduction) {
      // send email
    } else {
      Logger.info(`Verification code for ${user.email}: ${otp}`);
    }

    res
      .status(200)
      .json(
        success([
          { name: 'email_pending_verification', message: 'Verification code sent to email' },
        ]),
      );
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'email_error', "Couldn't send confirmation email"));
  }
};

const verifyEmail = async (
  req: TypedRequest<typeof verifyEmailSchema>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const username: string = res.locals.username;
    const { otp } = req.body;

    const user = await getUserByUsername(username);
    if (!user || !user.email) {
      next(new ErrorWithStatus(422, 'email_verification_error', "Couldn't verify email"));
      return;
    }

    const verification = await getVerification({ target: user.email, type: 'email' });
    if (!verification) {
      next(new ErrorWithStatus(422, 'email_verification_error', 'No verification pending'));
      return;
    }

    if (verification.expires_on && isVerificationExpired(verification.expires_on)) {
      await deleteVerification({ target: user.email, type: 'email' });
      next(new ErrorWithStatus(422, 'email_verification_error', 'Verification expired'));
      return;
    }

    const isValid = validateTOTP({ otp, ...verification });
    if (!isValid) {
      next(new ErrorWithStatus(422, 'email_verification_error', 'Invalid code'));
      return;
    }

    await deleteVerification({ target: user.email, type: 'email' });

    await updateEmailVerifiedTimestamp(user.email);

    res
      .status(200)
      .json(success([{ name: 'email_verified', message: 'Email successfully verified' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'email_verification_error', "Couldn't verify email"));
  }
};

export { updateEmail, verifyEmail, sendConfirmationEmail };
