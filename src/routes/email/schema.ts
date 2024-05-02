import { z } from 'zod';
import errorMessages from '../../util/errormessages';

export const updateEmailSchema = z.object({
  body: z.object({
    email: z.string().email({ message: errorMessages.EMAIL_INVALID }),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    otp: z.string().length(6, { message: errorMessages.OTP_INVALID }),
  }),
});
