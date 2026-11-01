import { z } from 'zod';
import { SortOrder } from './zodschema';

const positiveInteger = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.int().positive());

export const paginationSchema = z
  .object({
    page: positiveInteger.optional(),
    pageSize: positiveInteger.pipe(z.number().max(100)).optional(),
  })
  .transform(({ page, pageSize }) =>
    page === undefined && pageSize === undefined
      ? undefined
      : { page: page ?? 1, pageSize: pageSize ?? 50 },
  )
  .refine(
    (pagination) =>
      !pagination || Number.isSafeInteger((pagination.page - 1) * pagination.pageSize),
    { path: ['page'], message: 'Pagination offset is too large' },
  );

export type Pagination = NonNullable<z.output<typeof paginationSchema>>;

export type ListQuery = {
  sort: string;
  order: SortOrder;
  filter?: string[];
};

export type PaginatedResponse<T> = {
  results: T[];
  pagination: Pagination & { total: number; totalPages: number };
};
