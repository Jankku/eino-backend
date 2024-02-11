import z from 'zod';
import { dateStringSchema, fixedNonEmptyStringSchema } from '../../model/zodschema';

export const shareSchema = z.object({
  share_id: fixedNonEmptyStringSchema,
  created_on: dateStringSchema,
});

const dbShareSchema = shareSchema.extend({
  username: fixedNonEmptyStringSchema,
});

type DbShare = z.infer<typeof dbShareSchema>;

export default DbShare;
