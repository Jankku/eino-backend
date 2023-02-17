import { z } from 'zod';
import { isBookStatus } from '../db/model/bookstatus';
import { isMovieStatus } from '../db/model/moviestatus';
import errorMessages from '../util/errormessages';

export const dateSchema = z.optional(
  z.preprocess((arg) => {
    if (typeof arg == 'string' || arg instanceof Date) return new Date(arg);
  }, z.date())
);

export const listIdSchema = z.string({
  required_error: errorMessages.LIST_ID_REQUIRED,
  invalid_type_error: errorMessages.LIST_ID_TYPE_ERROR,
});

const coverUrlSchema = z.union([
  z.string().url().startsWith('https').nullable().default(null),
  z.literal(''),
]);

export const bookSchema = z.object({
  isbn: z.string().min(0).max(255),
  title: z.string().min(0).max(255),
  author: z.string().min(0).max(255),
  publisher: z.string().min(0).max(255),
  image_url: coverUrlSchema,
  pages: z.number().nonnegative(),
  year: z.number().nonnegative(),
  status: z.string().refine((status) => isBookStatus(status), {
    params: { name: 'invalid_status' },
    message: errorMessages.LIST_STATUS_INVALID,
  }),
  score: z.number().nonnegative().max(10),
  start_date: dateSchema,
  end_date: dateSchema,
});

export const movieSchema = z.object({
  title: z.string().min(0).max(255),
  studio: z.string().min(0).max(255),
  director: z.string().min(0).max(255),
  writer: z.string().min(0).max(255),
  duration: z.number().nonnegative(),
  year: z.number().nonnegative(),
  status: z.string().refine((status) => isMovieStatus(status), {
    params: { name: 'invalid_status' },
    message: errorMessages.LIST_STATUS_INVALID,
  }),
  score: z.number().min(0).max(10),
  start_date: dateSchema,
  end_date: dateSchema,
});

export const usernameSchema = z
  .string({
    required_error: errorMessages.USERNAME_REQUIRED,
    invalid_type_error: errorMessages.USERNAME_TYPE_ERROR,
  })
  .trim()
  .min(3, { message: errorMessages.USERNAME_LENGTH_INVALID })
  .max(255, { message: errorMessages.USERNAME_LENGTH_INVALID });

export const passwordSchema = z
  .string({
    required_error: errorMessages.PASSWORD_REQUIRED,
    invalid_type_error: errorMessages.PASSWORD_TYPE_ERROR,
  })
  .trim()
  .min(8, { message: errorMessages.PASSWORD_LENGTH_INVALID })
  .max(255, {
    message: errorMessages.PASSWORD_LENGTH_INVALID,
  });
