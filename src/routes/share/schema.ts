import { z } from 'zod';

export const getShareImageSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});
