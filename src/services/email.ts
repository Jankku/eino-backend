import { NextFunction, Response } from 'express';
import { db } from '../db/config';
import { success } from '../util/response';
import { ErrorWithStatus } from '../util/errorhandler';
import { generateTOTP, validateTOTP } from '../util/totp';
import { addVerification, deleteVerification, getVerification } from '../db/verification';
import Logger from '../util/logger';
import { getUserByUsername, isEmailVerified, updateEmailAddress } from '../db/users';
import { TypedRequest } from '../util/zod';
import { updateEmailSchema, verifyEmailSchema } from '../routes/email';

const updateEmail = async (
  req: TypedRequest<typeof updateEmailSchema>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const username: string = res.locals.username;
    const { email } = req.body;

    if (email.length === 0) {
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

    await updateEmailAddress(username, email);

    const { otp, secret, digits, period, algorithm, label } = await generateTOTP(email);

    await addVerification({
      type: 'email',
      target: label,
      secret,
      algorithm,
      digits,
      period,
    });

    // send email
    Logger.info(`Verification code for ${email}: ${otp}`);

    res
      .status(200)
      .json(
        success([
          { name: 'email_pending_verification', message: 'Verification code sent to email' },
        ]),
      );
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'email_error', "Couldn't update email"));
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
    if (!user.email) {
      next(new ErrorWithStatus(422, 'email_error', "Couldn't verify email"));
      return;
    }

    const verificationConfig = await getVerification(user.email);

    const isValid = validateTOTP({ otp, ...verificationConfig });

    if (!isValid) {
      next(new ErrorWithStatus(422, 'email_error', 'Invalid code'));
      return;
    }

    await deleteVerification(user.email);

    await db.none({
      text: `UPDATE users
             SET email_verified_on = CURRENT_TIMESTAMP(0)
             WHERE username = $1`,
      values: [username],
    });

    res
      .status(200)
      .json(success([{ name: 'email_verified', message: 'Email successfully verified' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'email_error', "Couldn't verify email"));
  }
};

export { updateEmail, verifyEmail };
