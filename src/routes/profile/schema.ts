import { z } from 'zod';
import {
  dateStringSchema,
  fixedNonEmptyStringSchema,
  otpSchema,
  passwordSchema,
} from '../../util/zodschema';
import { dbBookSchema } from '../../db/model/dbbook';
import { dbMovieSchema } from '../../db/model/dbmovie';
import { shareSchema } from '../../db/model/dbshare';

export const deleteAccountSchema = z.object({
  body: z.object({
    password: passwordSchema,
    twoFactorCode: otpSchema,
  }),
});

export const getProfileSchema = z.object({
  body: z.object({
    password: passwordSchema,
  }),
});

const scoreAverageSchema = z.object({
  score: z.number().nonnegative(),
  count: z.number().nonnegative(),
});

const commonCountSchema = z.object({
  all: z.number().nonnegative(),
  completed: z.number().nonnegative(),
  'on-hold': z.number().nonnegative(),
  dropped: z.number().nonnegative(),
  planned: z.number().nonnegative(),
});

const bookCountSchema = commonCountSchema.extend({
  reading: z.number().nonnegative(),
});

const movieCountSchema = commonCountSchema.extend({
  watching: z.number().nonnegative(),
});

export const profileInfoSchema = z.object({
  user_id: fixedNonEmptyStringSchema,
  username: fixedNonEmptyStringSchema,
  registration_date: dateStringSchema,
  stats: z.object({
    book: z.object({
      count: bookCountSchema,
      pages_read: z.number().nonnegative(),
      score_average: z.number().nonnegative(),
      score_distribution: z.array(scoreAverageSchema),
    }),
    movie: z.object({
      count: movieCountSchema,
      watch_time: z.number().nonnegative(),
      score_average: z.number().nonnegative(),
      score_distribution: z.array(scoreAverageSchema),
    }),
  }),
});

export const importProfileSchema = z.object({
  body: z.object({
    version: z.number().positive(),
    profile: profileInfoSchema,
    books: z.array(dbBookSchema),
    movies: z.array(dbMovieSchema),
    shares: z.array(shareSchema),
  }),
});
