import { Request, NextFunction } from 'express';
import { TypedResponse } from '../util/zod';
import { ErrorWithStatus } from '../util/errorhandler';

/**
Use after verifyToken middleware
*/
export const userEnabled = (_: Request, res: TypedResponse, next: NextFunction) => {
  if (res.locals.isDisabled) {
    next(new ErrorWithStatus(403, 'account_disabled', 'Your account is disabled'));
    return;
  }
  next();
};
