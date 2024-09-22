import z from 'zod';
import { dateStringSchema, fixedNonEmptyStringSchema } from '../../util/zodschema';

export const shareSchema = z.object({
  share_id: fixedNonEmptyStringSchema,
  created_on: dateStringSchema,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dbShareSchema = shareSchema.extend({
  username: fixedNonEmptyStringSchema,
});

export type DbShare = z.infer<typeof dbShareSchema>;
