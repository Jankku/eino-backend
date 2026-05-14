import { z } from 'zod';
import { errorMessages } from './errormessages';
import { languageCodes } from './languages';

export const dateStringSchema = z.string().refine((arg) => {
  if (!arg) return false;
  return !Number.isNaN(new Date(arg).getTime());
});

export const dateSchema = z.preprocess((arg) => {
  if (typeof arg == 'string' || arg instanceof Date) return new Date(arg);
}, z.date()) as z.ZodType<Date>;

export const nonEmptyString = z.string().min(1);

export const fixedStringSchema = z.string().min(0).max(255);

export const fixedNonEmptyStringSchema = z.string().min(1).max(255);

export const nonnegativeNumberSchema = z.number().nonnegative();

export const listIdSchema = z.string({
  error: (issue) =>
    issue.input === undefined ? errorMessages.LIST_ID_REQUIRED : errorMessages.LIST_ID_TYPE_ERROR,
});

export const scoreSchema = z.number().min(0).max(10);

export const coverUrlSchema = z.union([
  z.url({
    protocol: /^https?$/,
    hostname: z.regexes.domain,
  }),
  z.literal(''),
  z.null(),
  z.undefined(),
]);

export const languageCodeSchema = z.enum(languageCodes, {
  error: errorMessages.LANGUAGE_CODE_INVALID,
});

export const usernameSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? errorMessages.USERNAME_REQUIRED
        : errorMessages.USERNAME_TYPE_ERROR,
  })
  .trim()
  .min(3, { error: errorMessages.USERNAME_LENGTH_INVALID })
  .max(255, { error: errorMessages.USERNAME_LENGTH_INVALID });

export const passwordSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? errorMessages.PASSWORD_REQUIRED
        : errorMessages.PASSWORD_TYPE_ERROR,
  })
  .trim()
  .min(8, { error: errorMessages.PASSWORD_LENGTH_INVALID })
  .max(255, {
    error: errorMessages.PASSWORD_LENGTH_INVALID,
  });

export const emailSchema = z
  .email({
    error: (issue) => (issue.input === undefined ? errorMessages.EMAIL_REQUIRED : undefined),
  })
  .trim()
  .max(255, {
    error: errorMessages.EMAIL_INVALID,
  });

export const optionalEmailSchema = z
  .string()
  .trim()
  .min(0)
  .max(255, { error: errorMessages.EMAIL_INVALID })
  .nullish()
  .refine(
    (value) => {
      if (!value) return true;
      return value.includes('@');
    },
    { error: errorMessages.EMAIL_INVALID },
  );

export const usernameOrEmailSchema = z.union([usernameSchema, emailSchema]);

export const otpSchema = z
  .string({
    error: (issue) => (issue.input === undefined ? errorMessages.OTP_REQUIRED : undefined),
  })
  .min(6, errorMessages.OTP_INVALID)
  .max(6, errorMessages.OTP_INVALID);

export const optionalOtpSchema = z
  .string()
  .min(0, errorMessages.OTP_INVALID)
  .max(6, errorMessages.OTP_INVALID)
  .nullish();

export const sortOrderSchema = z.enum(['ascending', 'descending']).default('ascending');
export type SortOrder = z.infer<typeof sortOrderSchema>;
