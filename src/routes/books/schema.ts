import { z } from 'zod';
import { bookStatusEnum } from '../../db/model/bookstatus.ts';
import { errorMessages } from '../../util/errormessages.ts';
import { listIdSchema } from '../../util/zodschema.ts';
import { bookSchema, bookSortSchema } from '../../db/model/book.ts';

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
        error: (issue) =>
          issue.input === undefined ? errorMessages.ISBN_REQUIRED : errorMessages.ISBN_TYPE_ERROR,
      })
      .trim()
      .transform((value) => value.replaceAll(/[\s-]/g, ''))
      .refine((value) => value.length === 10 || value.length === 13, {
        error: errorMessages.ISBN_LENGTH_INVALID,
      })
      .refine((value) => /^\d+$/.test(value), {
        error: errorMessages.ISBN_INVALID,
      }),
  }),
});

export const fetchByStatusSchema = z.object({
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Zod requires an explicit fallback value.
  query: bookSortSchema.optional().catch(undefined),
  params: z.object({
    status: bookStatusEnum,
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
