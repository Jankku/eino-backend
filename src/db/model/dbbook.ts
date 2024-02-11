import z from 'zod';
import { bookSchema } from './book';
import { dateStringSchema, fixedStringSchema } from '../../model/zodschema';

export const dbBookSchema = bookSchema.extend({
  book_id: fixedStringSchema,
  created_on: dateStringSchema,
});

type DbBook = z.infer<typeof dbBookSchema>;

export default DbBook;
