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
import { DateTime } from 'luxon';
import { isVerificationExpired } from '../util/verification';
import { sendEmail } from '../util/email';
import { confirmEmailTemplate } from '../util/emailtemplates';

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
      next(new ErrorWithStatus(422, 'email_already_used', 'Email is already in use'));
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
      await deleteVerification({ target: email, type: 'email' });
    }

    await updateEmailAddress({ username, email });

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
      next(new ErrorWithStatus(422, 'email_already_verified', 'Email already verified'));
      return;
    }

    const totp = await generateTOTP({ label: user.email, period: 0 });

    await addVerification({
      ...totp,
      type: 'email',
      target: totp.label,
      expires_on: DateTime.now().plus({ minutes: 30 }).toJSDate(),
    });

    const emailResponse = await sendEmail({
      recipient: user.email,
      template: confirmEmailTemplate(totp.otp),
    });

    if (!emailResponse.success) {
      next(new ErrorWithStatus(424, 'email_error', "Couldn't send confirmation email"));
      return;
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
      next(new ErrorWithStatus(422, 'email_verification_not_found', 'No verification pending'));
      return;
    }

    if (verification.expires_on && isVerificationExpired(verification.expires_on)) {
      await deleteVerification({ target: user.email, type: 'email' });
      next(new ErrorWithStatus(422, 'email_verification_expired', 'Verification expired'));
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
