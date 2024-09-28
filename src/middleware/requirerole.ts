import { Request, NextFunction } from 'express';
import { TypedResponse } from '../util/zod';
import { Role } from '../db/role';
import { ErrorWithStatus } from '../util/errorhandler';

/**
 * Checks if the user has the required role for the route.
 * Use after verifyToken middleware.
 */
export const requireRole = (requiredRoles: Array<Role['name']>) => {
  return (_: Request, res: TypedResponse, next: NextFunction) => {
    if (!requiredRoles.includes(res.locals.role)) {
      next(
        new ErrorWithStatus(403, 'forbidden', 'You do not have permission to access this route'),
      );
      return;
    }
    next();
  };
};

export const requireAdmin = requireRole(['admin']);
