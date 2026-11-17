import { z } from 'zod';
import { errorMessages } from './errormessages.ts';
import { languageCodes } from './languages.ts';

export const dateStringSchema = z.string().refine((arg) => {
  return arg ? !Number.isNaN(new Date(arg).getTime()) : false;
});

export const dateSchema = z.preprocess((arg) => {
  if (typeof arg == 'string' || arg instanceof Date) {
    return new Date(arg);
  }
  return arg;
}, z.date()) as z.ZodType<Date>;

export const nonEmptyString = z.string().min(1);

export const fixedStringSchema = z.string().min(0).max(255);

export const fixedNonEmptyStringSchema = z.string().min(1).max(255);

export const noteSchema = z.string().max(10_000);

// Stored in Postgres INTEGER columns.
export const nonnegativeIntegerSchema = z.int32().nonnegative();

export const listIdSchema = z.uuid({
  error: (issue) =>
    issue.input === undefined ? errorMessages.LIST_ID_REQUIRED : errorMessages.UUID_INVALID,
});

export const scoreSchema = z.int().min(0).max(10);

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
  .max(255, { error: errorMessages.USERNAME_LENGTH_INVALID })
  // An @ would let a username shadow someone's email at login.
  .refine((value) => !value.includes('@'), { error: errorMessages.USERNAME_CONTAINS_AT_SIGN });

const passwordStringSchema = z.string({
  error: (issue) =>
    issue.input === undefined ? errorMessages.PASSWORD_REQUIRED : errorMessages.PASSWORD_TYPE_ERROR,
});

// Existing accounts were hashed and compared with the exact submitted password.
// Keep validating trimmed length, but never normalize the password itself.
export const passwordSchema = passwordStringSchema.superRefine((password, ctx) => {
  const result = z
    .string()
    .min(8, { error: errorMessages.PASSWORD_LENGTH_INVALID })
    .max(255, { error: errorMessages.PASSWORD_LENGTH_INVALID })
    .safeParse(password.trim());
  const issues = result.error?.issues ?? [];
  for (const issue of issues) ctx.addIssue({ ...issue });
});

export const passwordStrengthInputSchema = passwordStringSchema.superRefine((password, ctx) => {
  const result = z
    .string()
    .max(255, { error: errorMessages.PASSWORD_LENGTH_INVALID })
    .safeParse(password.trim());
  const issues = result.error?.issues ?? [];
  for (const issue of issues) ctx.addIssue({ ...issue });
});

// Trimmed before the format check, like optionalEmailSchema, so surrounding spaces are accepted.
export const emailSchema = z
  .string({
    error: (issue) => (issue.input === undefined ? errorMessages.EMAIL_REQUIRED : undefined),
  })
  .trim()
  .toLowerCase()
  .max(255, {
    error: errorMessages.EMAIL_INVALID,
  })
  .pipe(z.email());

export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, { error: errorMessages.EMAIL_INVALID })
  .refine((value) => value === '' || z.regexes.email.test(value), {
    error: errorMessages.EMAIL_INVALID,
  })
  .nullish();

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
