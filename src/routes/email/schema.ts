import { z } from 'zod';
import errorMessages from '../../util/errormessages';
import { optionalEmailSchema } from '../../util/zodschema';

export const updateEmailSchema = z.object({
  body: z.object({
    email: optionalEmailSchema,
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    otp: z.string().length(6, { message: errorMessages.OTP_INVALID }),
  }),
});