import { z } from 'zod';
import { dateStringSchema, fixedNonEmptyStringSchema } from '../../util/zodschema.ts';

const shareSchema = z.object({
  share_id: fixedNonEmptyStringSchema,
  created_on: dateStringSchema,
});

const dbShareSchema = shareSchema.extend({
  user_id: fixedNonEmptyStringSchema,
});

export type DbShare = z.infer<typeof dbShareSchema>;
