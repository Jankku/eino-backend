import z from 'zod';
import {
  coverUrlSchema,
  dateSchema,
  fixedStringSchema,
  positiveNumberSchema,
  scoreSchema,
  sortOrderSchema,
} from '../../model/zodschema';
import { movieStatusEnum } from './moviestatus';

export const movieSchema = z.object({
  title: fixedStringSchema,
  studio: fixedStringSchema,
  director: fixedStringSchema,
  writer: fixedStringSchema,
  image_url: coverUrlSchema,
  duration: positiveNumberSchema,
  year: positiveNumberSchema,
  status: movieStatusEnum,
  score: scoreSchema,
  start_date: dateSchema,
  end_date: dateSchema,
});

const movieSortableKeySchema = movieSchema.omit({ image_url: true }).keyof();

export const movieSortSchema = z.object({
  sort: movieSortableKeySchema.default('title'),
  order: sortOrderSchema,
});

type Movie = z.infer<typeof movieSchema>;

export default Movie;
