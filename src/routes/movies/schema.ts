import { z } from 'zod';
import { movieStatusEnum } from '../../db/model/moviestatus.ts';
import { listIdSchema } from '../../util/zodschema.ts';
import { errorMessages } from '../../util/errormessages.ts';
import { movieSchema, movieSortSchema } from '../../db/model/movie.ts';

export const searchSchema = z.object({
  query: z.object({
    query: z.string({
      error: (issue) =>
        issue.code === 'invalid_type' ? errorMessages.SEARCH_QUERY_TYPE_ERROR : undefined,
    }),
  }),
});

export const fetchOneSchema = z.object({
  params: z.object({
    movieId: listIdSchema,
  }),
});

export const addOneSchema = z.object({
  body: movieSchema,
});

export const updateOneSchema = z.object({
  body: movieSchema,
  params: z.object({
    movieId: listIdSchema,
  }),
});

export const deleteOneSchema = z.object({
  params: z.object({
    movieId: listIdSchema,
  }),
});

export const fetchByStatusSchema = z.object({
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Zod requires an explicit fallback value.
  query: movieSortSchema.optional().catch(undefined),
  params: z.object({
    status: movieStatusEnum,
  }),
});

export const fetchImagesSchema = z.object({
  query: z.object({
    query: z.string({
      error: (issue) =>
        issue.code === 'invalid_type' ? errorMessages.SEARCH_QUERY_TYPE_ERROR : undefined,
    }),
  }),
});
