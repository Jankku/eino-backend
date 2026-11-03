import type { Request, Response, NextFunction } from 'express';
import { type ZodType, ZodError } from 'zod/v4';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { formatZodErrors } from '../util/zod.ts';
import { z } from 'zod';
import { auditSecurityFailure, type SecurityOperation } from '../util/securityaudit.ts';

z.config({
  customError: (issue) => {
    if (issue.code !== 'custom') {
      return;
    }
    const field = issue.path?.at(-1);
    // oxlint-disable-next-line typescript/consistent-return
    return { message: `${String(field)}: ${issue.message}` };
  },
});

export const validateSchema =
  <T extends ZodType>(schema: T, operation?: SecurityOperation) =>
  async (req: Request, res: Response<unknown, { input: z.output<T> }>, next: NextFunction) => {
    try {
      res.locals.input = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (operation && error instanceof ZodError) {
        await auditSecurityFailure(req, res, { operation, reason: 'invalid_input' });
      }
      next(
        error instanceof ZodError
          ? formatZodErrors(error)
          : new ErrorWithStatus(
              500,
              'schema_validation_error',
              error instanceof Error
                ? error.message
                : 'Unknown error while trying to validate input',
            ),
      );
    }
  };
