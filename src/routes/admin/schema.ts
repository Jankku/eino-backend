import z from 'zod';
import { errorMessages } from '../../util/errormessages';
import { dateSchema, optionalEmailSchema, usernameSchema } from '../../util/zodschema';
import { db } from '../../db/config';
import { isEmailUnique } from '../../db/users';

export const editUserSchema = z
  .object({
    params: z.object({
      userId: z.string().uuid(errorMessages.UUID_INVALID),
    }),
    body: z.object({
      username: usernameSchema,
      email: optionalEmailSchema,
      email_verified_on: dateSchema.nullable(),
      role_id: z.number().int().positive(),
      profile_picture_path: z.string().nullable(),
      totp_enabled_on: dateSchema.nullable(),
    }),
  })
  .refine(
    async (data) => {
      if (!data.body.email) return true;
      return await db.task(async (t) => await isEmailUnique(t, data.body.email!));
    },
    {
      params: { name: 'admin_error' },
      message: errorMessages.EMAIL_ALREADY_USED,
    },
  );

export const deleteUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid(errorMessages.UUID_INVALID),
  }),
});
