import z from 'zod';
import {
  coverUrlSchema,
  dateSchema,
  fixedStringSchema,
  nonnegativeNumberSchema,
  scoreSchema,
  sortOrderSchema,
} from '../../util/zodschema';
import { movieStatusEnum } from './moviestatus';
import { parseFilter } from '../../util/sort';

export const movieSchema = z.object({
  title: fixedStringSchema,
  studio: fixedStringSchema,
  director: fixedStringSchema,
  writer: fixedStringSchema,
  image_url: coverUrlSchema,
  duration: nonnegativeNumberSchema,
  year: nonnegativeNumberSchema,
  status: movieStatusEnum,
  score: scoreSchema,
  start_date: dateSchema,
  end_date: dateSchema,
});

const movieSortableKeySchema = movieSchema.omit({ image_url: true }).keyof();

export const movieStringKeySchema = movieSortableKeySchema.exclude(['duration', 'year', 'score']);
export const movieNumberKeySchema = movieSortableKeySchema.extract(['duration', 'year', 'score']);

export const movieSortSchema = z.object({
  filter: z.union([
    z.string().transform((val) =>
      parseFilter({
        input: val,
        filterableKeySchema: movieSortableKeySchema,
        stringKeySchema: movieStringKeySchema,
        numberKeySchema: movieNumberKeySchema,
      }),
    ),
    z.void(),
  ]),
  sort: movieSortableKeySchema.default('title'),
  order: sortOrderSchema,
});

type Movie = z.infer<typeof movieSchema>;

export default Movie;
