import { z } from 'zod';
import {
  emailSchema,
  optionalEmailSchema,
  optionalOtpSchema,
  otpSchema,
  passwordSchema,
  passwordStrengthInputSchema,
  usernameOrEmailSchema,
  usernameSchema,
} from '../../util/zodschema.ts';
import { errorMessages } from '../../util/errormessages.ts';
import { getPasswordStrength } from '../../util/auth.ts';

export const registerSchema = z
  .object({
    body: z.object({
      username: usernameSchema,
      password: passwordSchema,
      password2: passwordSchema,
      email: optionalEmailSchema,
    }),
  })
  .refine((data) => data.body.password.trim() === data.body.password2.trim(), {
    params: { name: 'authentication_error' },
    error: errorMessages.PASSWORDS_NO_MATCH,
  })
  .refine((data) => !data.body.email || data.body.email?.includes('@'), {
    params: { name: 'authentication_error' },
    error: errorMessages.EMAIL_SHOULD_CONTAIN_AT_SIGN,
  })
  .superRefine(({ body }, ctx) => {
    const { isStrong, error } = getPasswordStrength({
      username: body.username,
      password: body.password.trim(),
    });
    if (!isStrong) {
      ctx.addIssue({ code: 'custom', message: error, params: { name: 'authentication_error' } });
    }
  });

export const loginSchema = z.object({
  body: z.object({
    username: usernameOrEmailSchema,
    password: passwordSchema,
    twoFactorCode: optionalOtpSchema,
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string({
        error: (issue) =>
          issue.input === undefined ? errorMessages.REFRESHTOKEN_REQUIRED : undefined,
      })
      .trim(),
  }),
});

export const passwordStrengthSchema = z.object({
  body: z.object({
    password: passwordStrengthInputSchema,
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    newPassword: passwordSchema,
    otp: otpSchema,
    twoFactorCode: optionalOtpSchema,
  }),
});

export const enable2FASchema = z.object({
  body: z.object({
    twoFactorCode: otpSchema,
  }),
});
