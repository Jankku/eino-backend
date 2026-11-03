import type { NextFunction, Request } from 'express';
import type { z } from 'zod';
import { type ListQuery, paginationSchema } from '../util/pagination.ts';
import { formatZodErrors, type TypedResponse } from '../util/zod.ts';

export const validatePagination =
  (sortSchema?: z.ZodType<ListQuery>) => (req: Request, res: TypedResponse, next: NextFunction) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) {
      next(formatZodErrors(pagination.error));
      return;
    }
    res.locals.pagination = pagination.data;
    if (sortSchema && pagination.data) {
      const query = sortSchema.safeParse(req.query);
      if (!query.success) {
        next(formatZodErrors(query.error));
        return;
      }
      if (query.data.filter?.length === 0) {
        next([{ name: 'invalid_filter', message: 'Invalid list filter' }]);
        return;
      }
      res.locals.listQuery = query.data;
    }
    next();
  };
