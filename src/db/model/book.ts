import z from 'zod';
import { bookStatusEnum } from './bookstatus';
import {
  coverUrlSchema,
  dateSchema,
  fixedStringSchema,
  positiveNumberSchema,
  scoreSchema,
} from '../../model/zodschema';

export const bookSchema = z.object({
  isbn: fixedStringSchema,
  title: fixedStringSchema,
  author: fixedStringSchema,
  publisher: fixedStringSchema,
  image_url: coverUrlSchema,
  pages: positiveNumberSchema,
  year: positiveNumberSchema,
  status: bookStatusEnum,
  score: scoreSchema,
  start_date: dateSchema,
  end_date: dateSchema,
});

type Book = z.infer<typeof bookSchema>;

export default Book;
