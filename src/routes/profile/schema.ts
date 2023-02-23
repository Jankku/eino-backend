import { z } from 'zod';
import { passwordSchema } from '../../model/zodschema';

export const deleteAccountSchema = z.object({
  body: z.object({
    password: passwordSchema,
  }),
});

export const getProfileSchema = z.object({
  body: z.object({
    password: passwordSchema,
  }),
});
