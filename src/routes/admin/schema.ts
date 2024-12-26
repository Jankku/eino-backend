import z from 'zod';
import { errorMessages } from '../../util/errormessages';
import {
  dateSchema,
  nonEmptyString,
  optionalEmailSchema,
  usernameSchema,
} from '../../util/zodschema';
import { db } from '../../db/config';
import { isEmailUnique } from '../../db/users';
import { bulletinConditions, bulletinTypes, bulletinVisibilities } from '../../db/bulletins';

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

export const enableUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid(errorMessages.UUID_INVALID),
  }),
});

export const disableUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid(errorMessages.UUID_INVALID),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid(errorMessages.UUID_INVALID),
  }),
});

export const createBulletinSchema = z
  .object({
    body: z.object({
      title: nonEmptyString,
      message: z.string().nullish(),
      name: z.string().nullish(),
      type: z.enum(bulletinTypes),
      visibility: z.enum(bulletinVisibilities),
      visibleToUserIds: z.array(z.string().uuid()).nullish(),
      condition: z.enum(bulletinConditions).nullish(),
      start_date: dateSchema,
      end_date: dateSchema,
    }),
  })
  .refine(
    ({ body }) => {
      if (body.visibility === 'condition' && !body.condition) {
        return false;
      }
      return true;
    },
    {
      params: { name: 'condition' },
      message: 'Condition required for condition visibility',
    },
  )
  .refine(
    ({ body }) => {
      if (
        body.visibility === 'user' &&
        (!body.visibleToUserIds || body.visibleToUserIds.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      params: { name: 'visibleToUserIds' },
      message: 'VisibleToUserIds required for user visibility',
    },
  );

export const deleteBulletinSchema = z.object({
  params: z.object({
    bulletinId: z.string().uuid(errorMessages.UUID_INVALID),
  }),
});
