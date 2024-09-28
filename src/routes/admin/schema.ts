import z from 'zod';
import { errorMessages } from '../../util/errormessages';

export const deleteUserSchema = z.object({
  params: z.object({
    userId: z.string().uuid(errorMessages.UUID_INVALID),
  }),
});
