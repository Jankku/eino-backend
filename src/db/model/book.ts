import z from 'zod';
import { bookStatusEnum } from './bookstatus';
import {
  coverUrlSchema,
  dateSchema,
  fixedStringSchema,
  nonnegativeNumberSchema,
  scoreSchema,
  sortOrderSchema,
} from '../../util/zodschema';
import { parseFilter } from '../../util/sort';

export const bookSchema = z.object({
  isbn: fixedStringSchema,
  title: fixedStringSchema,
  author: fixedStringSchema,
  publisher: fixedStringSchema,
  image_url: coverUrlSchema,
  pages: nonnegativeNumberSchema,
  year: nonnegativeNumberSchema,
  status: bookStatusEnum,
  score: scoreSchema,
  start_date: dateSchema,
  end_date: dateSchema,
});

const bookSortableKeySchema = bookSchema.omit({ image_url: true, isbn: true }).keyof();

export const bookStringKeySchema = bookSortableKeySchema.exclude(['pages', 'year', 'score']);
export const bookNumberKeySchema = bookSortableKeySchema.extract(['pages', 'year', 'score']);

export const bookSortSchema = z.object({
  filter: z.union([
    z.string().transform((val) =>
      parseFilter({
        input: val,
        filterableKeySchema: bookSortableKeySchema,
        stringKeySchema: bookStringKeySchema,
        numberKeySchema: bookNumberKeySchema,
      }),
    ),
    z.void(),
  ]),
  sort: bookSortableKeySchema.default('title'),
  order: sortOrderSchema,
});

type Book = z.infer<typeof bookSchema>;

export default Book;
