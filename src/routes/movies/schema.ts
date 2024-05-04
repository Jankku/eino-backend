import { z } from 'zod';
import { movieStatusEnum } from '../../db/model/moviestatus';
import { listIdSchema } from '../../model/zodschema';
import errorMessages from '../../util/errormessages';
import { movieSchema } from '../../db/model/movie';

export const searchSchema = z.object({
  query: z.object({
    query: z.string({ invalid_type_error: errorMessages.SEARCH_QUERY_TYPE_ERROR }),
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
  params: z.object({
    status: movieStatusEnum,
  }),
});

export const fetchImagesSchema = z.object({
  query: z.object({
    query: z.string({ invalid_type_error: errorMessages.SEARCH_QUERY_TYPE_ERROR }),
  }),
});
