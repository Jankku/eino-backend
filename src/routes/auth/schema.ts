import { z } from 'zod';
import { isEmailUnique, isUserUnique } from '../../db/users';
import {
  emailSchema,
  optionalEmailSchema,
  otpSchema,
  passwordSchema,
  usernameOrEmailSchema,
  usernameSchema,
} from '../../util/zodschema';
import errorMessages from '../../util/errormessages';
import { getPasswordStrength } from '../../util/auth';

export const registerSchema = z
  .object({
    body: z.object({
      username: usernameSchema,
      password: passwordSchema,
      password2: passwordSchema,
      email: optionalEmailSchema,
    }),
  })
  .refine((data) => data.body.password === data.body.password2, {
    params: { name: 'authentication_error' },
    message: errorMessages.PASSWORDS_NO_MATCH,
  })
  .refine(async (data) => await isUserUnique(data.body.username), {
    params: { name: 'authentication_error' },
    message: errorMessages.USER_EXISTS,
  })
  .refine(
    async (data) => {
      if (!data.body.email) return true;
      if (!data.body.email.includes('@')) return false;
      return await isEmailUnique(data.body.email);
    },
    {
      params: { name: 'authentication_error' },
      message: errorMessages.EMAIL_EXISTS,
    },
  )
  .superRefine(({ body }, ctx) => {
    const { isStrong, error } = getPasswordStrength({
      username: body.username,
      password: body.password,
    });
    if (!isStrong) {
      ctx.addIssue({ code: 'custom', message: error, params: { name: 'authentication_error' } });
    }
  });

export const loginSchema = z.object({
  body: z.object({
    username: usernameOrEmailSchema,
    password: passwordSchema,
    otp: otpSchema.optional(),
  }),
});

export const loginConfigSchema = z.object({
  body: z.object({
    username: usernameSchema,
    password: passwordSchema,
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string({ required_error: errorMessages.REFRESHTOKEN_REQUIRED }),
  }),
});

export const passwordStrengthSchema = z.object({
  body: z.object({
    password: z
      .string({
        required_error: errorMessages.PASSWORD_REQUIRED,
        invalid_type_error: errorMessages.PASSWORD_TYPE_ERROR,
      })
      .trim()
      .max(255, {
        message: errorMessages.PASSWORD_LENGTH_INVALID,
      }),
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
    twoFactorCode: otpSchema.optional(),
  }),
});

export const enable2FASchema = z.object({
  body: z.object({
    otp: otpSchema,
  }),
});
