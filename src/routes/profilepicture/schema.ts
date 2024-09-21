import { z } from 'zod';
import errorMessages from '../../util/errormessages';

export const getProfilePictureSchema = z.object({
  params: z.object({
    fileName: z.string().refine((value) => value.endsWith('.avif'), {
      params: { name: 'profile_picture_error' },
      message: errorMessages.FILE_EXTENSION_INVALID,
    }),
  }),
});
