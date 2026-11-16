import type { Request, Response, NextFunction } from 'express';
import { type ZodType, ZodError } from 'zod/v4';
import { formatZodErrors } from '../util/zod.ts';
import { z } from 'zod';
import {
  auditSecurityFailureAfterResponse,
  type SecurityOperation,
} from '../util/securityaudit.ts';

export const validateSchema =
  <T extends ZodType>(schema: T, operation?: SecurityOperation) =>
  async (req: Request, res: Response<unknown, { input: z.output<T> }>, next: NextFunction) => {
    try {
      res.locals.input = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
    } catch (error) {
      if (!(error instanceof ZodError)) throw error;
      if (operation) {
        auditSecurityFailureAfterResponse(req, res, { operation, reason: 'invalid_input' });
      }
      next(formatZodErrors(error));
      return;
    }
    next();
  };
