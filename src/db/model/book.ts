import { z } from 'zod';
import { bookStatusEnum } from './bookstatus';
import {
  coverUrlSchema,
  dateSchema,
  dateStringSchema,
  fixedStringSchema,
  languageCodeSchema,
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
  note: z.string().nullish(),
  language_code: languageCodeSchema.nullish(),
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

export const bookDateKeySchema = bookSortableKeySchema.extract([
  'start_date',
  'end_date',
  'created_on',
]);
export const bookStringKeySchema = bookSortableKeySchema.exclude([
  'pages',
  'year',
  'score',
  'start_date',
  'end_date',
  'created_on',
]);
export const bookNumberKeySchema = bookSortableKeySchema.extract(['pages', 'year', 'score']);

export const bookSortSchema = z.object({
  filter: z
    .string()
    .transform((val) =>
      parseFilter({
        input: val,
        filterableKeySchema: bookSortableKeySchema,
        stringKeySchema: bookStringKeySchema,
        numberKeySchema: bookNumberKeySchema,
        dateKeySchema: bookDateKeySchema,
      }),
    )
    .optional(),
  sort: bookSortableKeySchema.default('title'),
  order: sortOrderSchema,
});

export type Book = z.infer<typeof bookSchema>;
export type BookFormSchema = Omit<Book, 'status' | 'score' | 'start_date' | 'end_date'>;
export type DbBook = z.infer<typeof dbBookSchema>;
