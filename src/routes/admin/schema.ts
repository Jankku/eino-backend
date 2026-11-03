import { z } from 'zod';
import { errorMessages } from '../../util/errormessages.ts';
import {
  dateSchema,
  nonEmptyString,
  optionalEmailSchema,
  usernameSchema,
} from '../../util/zodschema.ts';
import { db } from '../../db/config.ts';
import { isEmailUniqueExcludeUsername } from '../../db/users.ts';
import { bulletinConditions, bulletinTypes, bulletinVisibilities } from '../../db/bulletins.ts';

const overviewDateSchema = z.iso.date().refine((value) => !value.startsWith('0000'), {
  message: 'Year must be at least 0001',
});

export const auditQuerySchema = z.object({
  query: z.object({
    security_events: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  }),
});

export const overviewSchema = z.object({
  query: z
    .object({
      start_date: overviewDateSchema.optional(),
      end_date: overviewDateSchema.optional(),
    })
    .refine(({ start_date, end_date }) => Boolean(start_date) === Boolean(end_date), {
      message: 'Provide both start_date and end_date, or neither',
    })
    .refine(({ start_date, end_date }) => !start_date || !end_date || start_date <= end_date, {
      message: 'start_date must be on or before end_date',
    }),
});

export const editUserSchema = z
  .object({
    params: z.object({
      userId: z.uuid(errorMessages.UUID_INVALID),
    }),
    body: z.object({
      username: usernameSchema,
      email: optionalEmailSchema,
      email_verified_on: dateSchema.nullable(),
      role_id: z.int().positive(),
      profile_picture_path: z.string().nullable(),
      totp_enabled_on: dateSchema.nullable(),
    }),
  })
  .refine(
    async (data) => {
      return data.body.email
        ? await db.task(
            async (t) =>
              await isEmailUniqueExcludeUsername(t, data.body.username, data.body.email!),
          )
        : true;
    },
    {
      params: { name: 'admin_error' },
      error: errorMessages.EMAIL_ALREADY_USED,
    },
  );

export const enableUserSchema = z.object({
  params: z.object({
    userId: z.uuid(errorMessages.UUID_INVALID),
  }),
});

export const disableUserSchema = z.object({
  params: z.object({
    userId: z.uuid(errorMessages.UUID_INVALID),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    userId: z.uuid(errorMessages.UUID_INVALID),
  }),
});

const bulletinSchema = z
  .object({
    body: z.object({
      title: nonEmptyString,
      message: z.string().nullish(),
      name: z.string().nullish(),
      type: z.enum(bulletinTypes),
      visibility: z.enum(bulletinVisibilities),
      visibleToUserIds: z.array(z.uuid()).nullish(),
      condition: z.enum(bulletinConditions).nullish(),
      start_date: dateSchema,
      end_date: dateSchema,
    }),
  })
  .refine(
    ({ body }) => {
      return !(body.visibility === 'condition' && !body.condition);
    },
    {
      params: { name: 'condition' },
      message: 'Condition required for condition visibility',
    },
  );

export const createBulletinSchema = bulletinSchema.refine(
  ({ body }) => {
    return !(
      body.visibility === 'user' &&
      (!body.visibleToUserIds || body.visibleToUserIds.length === 0)
    );
  },
  {
    params: { name: 'visibleToUserIds' },
    message: 'VisibleToUserIds required for user visibility',
  },
);

export const deleteBulletinSchema = z.object({
  params: z.object({
    bulletinId: z.uuid(errorMessages.UUID_INVALID),
  }),
});

export const editBulletinSchema = bulletinSchema.safeExtend({
  params: z.object({ bulletinId: z.uuid(errorMessages.UUID_INVALID) }),
});
