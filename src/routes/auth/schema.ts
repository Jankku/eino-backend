import { z } from 'zod';
import { isUserUnique } from '../../db/users';
import { passwordSchema, usernameSchema } from '../../model/zodschema';
import errorMessages from '../../util/errormessages';
import { getPasswordStrength } from '../../util/auth';

export const registerSchema = z
  .object({
    body: z.object({
      username: usernameSchema,
      password: passwordSchema,
      password2: passwordSchema,
    }),
  })
  .refine((data) => data.body.password === data.body.password2, {
    params: { name: 'authentication_error' },
    message: "Passwords don't match",
  })
  .superRefine(({ body }, ctx) => {
    const { isStrong, error } = getPasswordStrength({
      username: body.username,
      password: body.password,
    });
    if (!isStrong) {
      ctx.addIssue({ code: 'custom', message: error, params: { name: 'authentication_error' } });
    }
  })
  .refine(async (data) => await isUserUnique(data.body.username), {
    params: { name: 'user_exists' },
    message: errorMessages.USER_EXISTS,
  });

export const loginSchema = z.object({
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
