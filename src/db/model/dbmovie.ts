import z from 'zod';
import { dateStringSchema, fixedStringSchema } from '../../util/zodschema';
import { movieSchema } from './movie';

export const dbMovieSchema = movieSchema.extend({
  movie_id: fixedStringSchema,
  created_on: dateStringSchema,
});

type DbMovie = z.infer<typeof dbMovieSchema>;

export default DbMovie;
