import { z } from 'zod';
import { isBookStatus } from '../../db/model/bookstatus';
import errorMessages from '../../util/errormessages';
import { bookSchema, listIdSchema } from '../../model/zodschema';

export const searchSchema = z.object({
  query: z.object({
    query: z.string({ invalid_type_error: errorMessages.SEARCH_QUERY_TYPE_ERROR }),
  }),
});

export const fetchOneSchema = z.object({
  params: z.object({
    bookId: listIdSchema,
  }),
});

export const addOneSchema = z.object({
  body: bookSchema,
});

export const updateOneSchema = z.object({
  body: bookSchema,
  params: z.object({
    bookId: listIdSchema,
  }),
});

export const deleteOneSchema = z.object({
  params: z.object({
    bookId: listIdSchema,
  }),
});

export const fetchByStatusSchema = z.object({
  params: z.object({
    status: z.string().refine((status) => isBookStatus(status), errorMessages.LIST_STATUS_INVALID),
  }),
});
