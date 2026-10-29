import { Request, NextFunction } from 'express';
import { TypedResponse } from '../util/zod';
import { SecurityErrorWithStatus } from '../util/errorhandler';

/**
Use after verifyToken middleware
*/
export const userEnabled = (_: Request, res: TypedResponse, next: NextFunction) => {
  if (res.locals.isDisabled) {
    next(
      new SecurityErrorWithStatus(403, 'account_disabled', 'Your account is disabled', {
        operation: 'account_enabled_check',
        reason: 'account_disabled',
      }),
    );
    return;
  }
  next();
};
