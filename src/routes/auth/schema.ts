import { z } from 'zod';
import { isUserUnique } from '../../db/users';
import { passwordSchema, usernameSchema } from '../../model/zodschema';
import errorMessages from '../../util/errormessages';

export const registerSchema = z
  .object({
    body: z.object({
      username: usernameSchema,
      password: passwordSchema,
      password2: passwordSchema,
    }),
  })
  .refine((data) => data.body.password === data.body.password2, {
    params: { name: 'password_error' },
    message: "Passwords don't match",
  })
  .refine(async (data) => await isUserUnique(data.body.username), {
    message: errorMessages.USER_EXISTS,
    params: { name: 'user_exists' },
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
