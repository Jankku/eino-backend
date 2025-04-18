import { z } from 'zod';
import { errorMessages } from './errormessages';

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
  required_error: errorMessages.LIST_ID_REQUIRED,
  invalid_type_error: errorMessages.LIST_ID_TYPE_ERROR,
});

export const scoreSchema = z.number().min(0).max(10);

export const coverUrlSchema = z.union([
  z.string().url().startsWith('https'),
  z.literal(''),
  z.null(),
  z.undefined(),
]);

export const usernameSchema = z
  .string({
    required_error: errorMessages.USERNAME_REQUIRED,
    invalid_type_error: errorMessages.USERNAME_TYPE_ERROR,
  })
  .trim()
  .min(3, { message: errorMessages.USERNAME_LENGTH_INVALID })
  .max(255, { message: errorMessages.USERNAME_LENGTH_INVALID });

export const passwordSchema = z
  .string({
    required_error: errorMessages.PASSWORD_REQUIRED,
    invalid_type_error: errorMessages.PASSWORD_TYPE_ERROR,
  })
  .trim()
  .min(8, { message: errorMessages.PASSWORD_LENGTH_INVALID })
  .max(255, {
    message: errorMessages.PASSWORD_LENGTH_INVALID,
  });

export const emailSchema = z
  .string({
    required_error: errorMessages.EMAIL_REQUIRED,
  })
  .trim()
  .email()
  .max(255, {
    message: errorMessages.EMAIL_INVALID,
  });

export const optionalEmailSchema = z
  .string()
  .trim()
  .min(0)
  .max(255, {
    message: errorMessages.EMAIL_INVALID,
  })
  .nullish()
  .refine(
    (value) => {
      if (!value) return true;
      return value.includes('@');
    },
    {
      message: errorMessages.EMAIL_INVALID,
    },
  );

export const usernameOrEmailSchema = z.union([usernameSchema, emailSchema]);

export const otpSchema = z
  .string({ required_error: errorMessages.OTP_REQUIRED })
  .min(6, errorMessages.OTP_INVALID)
  .max(6, errorMessages.OTP_INVALID);

export const optionalOtpSchema = z
  .string()
  .min(0, errorMessages.OTP_INVALID)
  .max(6, errorMessages.OTP_INVALID)
  .nullish();

export const sortOrderSchema = z.enum(['ascending', 'descending']).default('ascending');
export type SortOrder = z.infer<typeof sortOrderSchema>;
