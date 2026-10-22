import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod/v4';
import { ErrorWithStatus } from '../util/errorhandler';
import { formatZodErrors } from '../util/zod';
import { z } from 'zod';

z.config({
  customError: (issue) => {
    if (issue.code !== 'custom') {
      return;
    }
    const field = issue.path?.at(-1);
    return { message: `${String(field)}: ${issue.message}` };
  },
});

export const validateSchema =
  (schema: ZodType) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      next(
        error instanceof ZodError
          ? formatZodErrors(error)
          : new ErrorWithStatus(500, 'schema_validation_error', (error as Error)?.message),
      );
    }
  };
