import { z } from 'zod';
import { bookStatusEnum } from '../../db/model/bookstatus';
import { errorMessages } from '../../util/errormessages';
import { listIdSchema } from '../../util/zodschema';
import { bookSchema } from '../../db/model/book';

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

export const searchIsbnSchema = z.object({
  params: z.object({
    isbn: z
      .string({
        required_error: errorMessages.ISBN_REQUIRED,
        invalid_type_error: errorMessages.ISBN_TYPE_ERROR,
      })
      .trim()
      .transform((value) => value.replaceAll(/[\s-]/g, ''))
      .refine((value) => value.length === 10 || value.length === 13, {
        message: errorMessages.ISBN_LENGTH_INVALID,
      })
      .refine((value) => /^\d+$/.test(value), {
        message: errorMessages.ISBN_INVALID,
      }),
  }),
});

export const fetchByStatusSchema = z.object({
  params: z.object({
    status: bookStatusEnum,
  }),
});

export const fetchImagesSchema = z.object({
  query: z.object({
    query: z.string({ invalid_type_error: errorMessages.SEARCH_QUERY_TYPE_ERROR }),
  }),
});
