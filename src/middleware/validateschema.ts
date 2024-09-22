import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ErrorWithStatus } from '../util/errorhandler';
import { formatZodErrors } from '../util/zod';

const customErrorMap: z.ZodErrorMap = (error, ctx) => {
  const field = error.path.at(-1);
  const message = error.message ?? ctx.defaultError;
  return { message: `${field}: ${message}` };
};

z.setErrorMap(customErrorMap);

export const validateSchema =
  (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(formatZodErrors(error));
      } else {
        next(new ErrorWithStatus(500, 'schema_validation_error', `${(error as Error)?.message}`));
      }
    }
  };
