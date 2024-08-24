import { z } from 'zod';
import errorMessages from '../../util/errormessages';
import { emailSchema } from '../../model/zodschema';

export const updateEmailSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    otp: z.string().length(6, { message: errorMessages.OTP_INVALID }),
  }),
});
