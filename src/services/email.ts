import type { Request } from 'express';
import { success } from '../util/response.ts';
import { ErrorWithStatus, SecurityErrorWithStatus } from '../util/errorhandler.ts';
import { generateTOTP, validateEmailOTP, validateTOTP } from '../util/totp.ts';
import { addVerification, deleteVerifications, findVerification } from '../db/verification.ts';
import {
  getUserByIdForUpdate,
  isEmailAlreadyUsed,
  updateEmailAddress,
  updateEmailVerifiedTimestamp,
} from '../db/users.ts';
import type { TypedResponse } from '../util/zod.ts';
import type { updateEmailSchema, verifyEmailSchema } from '../routes/email/index.ts';
import { DateTime } from 'luxon';
import { isVerificationExpired } from '../util/verification.ts';
import { sendEmail } from '../util/email.ts';
import { confirmEmailTemplate } from '../util/emailtemplates.ts';
import { db } from '../db/config.ts';
import { addAudit } from '../db/audit.ts';

export const updateEmail = async (_: Request, res: TypedResponse<typeof updateEmailSchema>) => {
  const { userId, username } = res.locals;
  const { email, twoFactorCode } = res.locals.input.body;
  const result = await db.tx('updateEmail', async (t) => {
    const user = await getUserByIdForUpdate(t, userId);

    if (user.totp_enabled_on) {
      if (!twoFactorCode) {
        throw new SecurityErrorWithStatus(422, 'update_email_error', 'Two-factor code required', {
          operation: 'email_update',
          reason: 'otp_required',
          targetUserId: userId,
        });
      }

      const twoFactorVerification = await findVerification(t, {
        userId,
        type: '2fa',
      });
      if (
        !twoFactorVerification ||
        !validateTOTP({ otp: twoFactorCode, ...twoFactorVerification })
      ) {
        throw new SecurityErrorWithStatus(422, 'update_email_error', 'Incorrect two-factor code', {
          operation: 'email_update',
          reason: 'invalid_otp',
          targetUserId: userId,
        });
      }
    }

    // Codes sent to the previous address must not verify a new one.
    await deleteVerifications(t, { userId, type: 'email' });

    if (!email) {
      await updateEmailAddress(t, { userId, email: undefined });
      await addAudit(t, {
        actor_user_id: res.locals.userId,
        username,
        action: 'email_updated',
        old_data: { email: user.email },
        new_data: { email: undefined },
      });
      return { name: 'email_removed', message: 'Email successfully removed' };
    }

    const isEmailUsed = await isEmailAlreadyUsed(t, { userId, email });
    if (isEmailUsed) {
      throw new ErrorWithStatus(409, 'email_already_used', 'Email is already in use');
    }

    if (user.email === email && user.email_verified_on) {
      return { name: 'email_already_verified', message: 'Email is already verified' };
    }

    await updateEmailAddress(t, { userId, email });
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username,
      action: 'email_updated',
      old_data: { email: user.email },
      new_data: { email },
    });
    return { name: 'email_updated', message: 'Email updated' };
  });

  res.status(200).json(success([result]));
};

export const sendConfirmationEmail = async (_req: Request, res: TypedResponse) => {
  const { userId, username } = res.locals;

  const { email, otp } = await db.tx('sendConfirmationEmail', async (t) => {
    // Locked so concurrent requests replace the code one after another.
    const user = await getUserByIdForUpdate(t, userId);

    if (!user.email) {
      throw new ErrorWithStatus(422, 'email_error', "Couldn't send confirmation email");
    }

    if (user.email_verified_on) {
      throw new ErrorWithStatus(422, 'email_already_verified', 'Email already verified');
    }
    if (await isEmailAlreadyUsed(t, { userId, email: user.email })) {
      throw new ErrorWithStatus(409, 'email_already_used', 'Email is already in use');
    }

    const totp = generateTOTP({
      label: user.email,
      period: 60 * 15, // 15 minutes
    });

    await deleteVerifications(t, { userId, type: 'email' });
    await addVerification(t, {
      ...totp,
      user_id: userId,
      type: 'email',
      target: totp.label,
      expires_on: DateTime.now().plus({ minutes: 15 }).toJSDate(),
    });

    return { email: user.email, otp: totp.otp };
  });

  const emailResponse = await sendEmail({
    recipient: email,
    template: confirmEmailTemplate(otp),
  });

  if (!emailResponse.success) {
    throw new ErrorWithStatus(424, 'email_error', "Couldn't send confirmation email");
  }

  await db.task('sendConfirmationEmail', (t) =>
    addAudit(t, {
      actor_user_id: userId,
      username,
      action: 'email_verification_email_sent',
    }),
  );

  res
    .status(200)
    .json(
      success([{ name: 'email_pending_verification', message: 'Verification code sent to email' }]),
    );
};

export const verifyEmail = async (_: Request, res: TypedResponse<typeof verifyEmailSchema>) => {
  const { userId, username } = res.locals;
  const { otp } = res.locals.input.body;

  await db.tx('verifyEmail', async (t) => {
    // Locked so a code can be used only once.
    const user = await getUserByIdForUpdate(t, userId);

    if (!user.email) {
      throw new SecurityErrorWithStatus(422, 'email_verification_error', "Couldn't verify email", {
        operation: 'email_verify',
        reason: 'email_missing',
        targetUserId: userId,
      });
    }

    const verification = await findVerification(t, {
      userId,
      type: 'email',
      target: user.email,
    });
    if (!verification) {
      throw new SecurityErrorWithStatus(
        422,
        'email_verification_error',
        'Invalid one-time password',
        {
          operation: 'email_verify',
          reason: 'verification_missing',
          targetUserId: userId,
        },
      );
    }

    if (verification.expires_on && isVerificationExpired(verification.expires_on)) {
      await deleteVerifications(t, { userId, type: 'email' });
      throw new SecurityErrorWithStatus(422, 'email_verification_expired', 'Verification expired', {
        operation: 'email_verify',
        reason: 'verification_expired',
        targetUserId: userId,
      });
    }

    if (!validateEmailOTP({ otp, ...verification })) {
      throw new SecurityErrorWithStatus(
        422,
        'email_verification_error',
        'Invalid one-time password',
        { operation: 'email_verify', reason: 'invalid_otp', targetUserId: userId },
      );
    }

    await deleteVerifications(t, { userId, type: 'email' });
    await updateEmailVerifiedTimestamp(t, { userId, email: user.email });
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username,
      action: 'email_verified',
      old_data: { email: user.email },
    });
  });

  res
    .status(200)
    .json(success([{ name: 'email_verified', message: 'Email successfully verified' }]));
};
