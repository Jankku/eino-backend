import z from 'zod';
import { bookStatusEnum } from './bookstatus';
import {
  coverUrlSchema,
  dateSchema,
  dateStringSchema,
  fixedStringSchema,
  nonnegativeNumberSchema,
  scoreSchema,
  sortOrderSchema,
} from '../../util/zodschema';
import { parseFilter } from '../../util/sort';
import { languageCodes } from '../../util/languages';
import { errorMessages } from '../../util/errormessages';

export const bookSchema = z.object({
  isbn: fixedStringSchema,
  title: fixedStringSchema,
  author: fixedStringSchema,
  publisher: fixedStringSchema,
  image_url: coverUrlSchema,
  note: z.string().nullish(),
  language_code: z.enum(languageCodes, { message: errorMessages.LANGUAGE_CODE_INVALID }).nullish(),
  pages: nonnegativeNumberSchema,
  year: nonnegativeNumberSchema,
  status: bookStatusEnum,
  score: scoreSchema,
  start_date: dateSchema,
  end_date: dateSchema,
});

export const dbBookSchema = bookSchema.extend({
  book_id: fixedStringSchema,
  created_on: dateStringSchema,
});

const bookSortableKeySchema = dbBookSchema
  .omit({ book_id: true, image_url: true, isbn: true, note: true, language_code: true })
  .keyof();

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

export type Book = z.infer<typeof bookSchema>;
export type DbBook = z.infer<typeof dbBookSchema>;
