import { NextFunction, Request, Response } from 'express';
import { success } from '../util/response';
import { ErrorWithStatus } from '../util/errorhandler';
import { generateOTP, generateTOTP, validateTOTP } from '../util/totp';
import { addVerification, deleteVerification, getVerification } from '../db/verification';
import Logger from '../util/logger';
import {
  getUserByUsername,
  isEmailVerified,
  updateEmailAddress,
  updateEmailVerifiedTimestamp,
} from '../db/users';
import { TypedRequest } from '../util/zod';
import { updateEmailSchema, verifyEmailSchema } from '../routes/email';
import { config } from '../config';
import { DateTime } from 'luxon';

const updateEmail = async (
  req: TypedRequest<typeof updateEmailSchema>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const username: string = res.locals.username;
    const { email } = req.body;

    if (!email) {
      await updateEmailAddress(username, null);
      res
        .status(200)
        .json(success([{ name: 'email_removed', message: 'Email successfully removed' }]));
      return;
    }

    const isVerified = await isEmailVerified(email);
    if (isVerified) {
      res
        .status(200)
        .json(success([{ name: 'email_already_verified', message: 'Email is already verified' }]));
      return;
    }

    const verificationExists = await getVerification(email, 'email');
    if (verificationExists) {
      next(new ErrorWithStatus(422, 'email_error', 'Verification already pending'));
      return;
    }

    await updateEmailAddress(username, email);

    const { secret, digits, period, algorithm, label } = await generateTOTP(email);

    await addVerification({
      type: 'email',
      target: label,
      secret,
      algorithm,
      digits,
      period,
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

    const verification = await getVerification(user.email, 'email');
    if (!verification) {
      next(new ErrorWithStatus(422, 'email_error', "Couldn't send confirmation email"));
      return;
    }

    const otp = generateOTP({ ...verification, label: user.email });

    if (config.NODE_ENV === 'production') {
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

    const verificationConfig = await getVerification(user.email, 'email');
    if (!verificationConfig) {
      next(new ErrorWithStatus(422, 'email_verification_error', 'No verification pending'));
      return;
    }

    const diff = DateTime.fromISO(verificationConfig.expires_on!.toISOString(), {
      zone: 'utc',
    }).diffNow('minutes');
    if (diff.minutes < 0) {
      await deleteVerification(user.email, 'email');
      next(new ErrorWithStatus(422, 'email_verification_error', 'Verification expired'));
      return;
    }

    const isValid = validateTOTP({ otp, ...verificationConfig });
    if (!isValid) {
      next(new ErrorWithStatus(422, 'email_verification_error', 'Invalid code'));
      return;
    }

    await deleteVerification(user.email, 'email');

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
