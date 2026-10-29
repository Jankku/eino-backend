import { NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import { config } from '../config';
import { ErrorWithStatus, SecurityErrorWithStatus } from '../util/errorhandler';
import { formatZodErrors, TypedResponse } from '../util/zod';
import { getTokenSubject } from '../util/auth';
import { db } from '../db/config';
import { findUserById } from '../db/users';
import { roleIdToName } from '../util/role';
import { jwtConstants } from '../util/jwtconstants';
import { Logger } from '../util/logger';
import { auditSecurityFailure } from '../util/securityaudit';

const tokenSchema = z.object({
  headers: z.object({
    authorization: z
      .string({
        error: (issue) => (issue.input === undefined ? 'Authorization header required' : undefined),
      })
      .refine((val) => val.split(' ', 1)[0] === 'Bearer', {
        params: {
          name: 'authorization_error',
        },
        message: 'Authorization header must be Bearer',
      })
      .transform((val) => val.split(' ', 2)[1]),
  }),
});

/**
Verifies that user's access token is valid
*/
export const verifyToken = async (req: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const accessToken = tokenSchema.parse(req).headers.authorization;
    const userId = getTokenSubject(
      jwt.verify(accessToken, config.ACCESS_TOKEN_SECRET, {
        audience: jwtConstants.AUDIENCE,
        issuer: jwtConstants.ISSUER,
      }),
    );
    const user = await db.task((t) => findUserById(t, userId));
    if (!user) {
      throw new SecurityErrorWithStatus(401, 'authorization_error', 'Account no longer exists', {
        operation: 'access_token',
        reason: 'account_not_found',
        targetUserId: userId,
      });
    }

    res.locals.userId = user.user_id;
    res.locals.username = user.username;
    res.locals.role = roleIdToName(user.role_id);
    res.locals.isDisabled = !!user.disabled_on;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      await auditSecurityFailure(req, res, {
        operation: 'access_token',
        reason: 'invalid_authorization_header',
      });
      next(formatZodErrors(error));
    } else if (error instanceof ErrorWithStatus) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(
        new SecurityErrorWithStatus(401, 'authorization_error', error.message, {
          operation: 'access_token',
          reason: error instanceof jwt.TokenExpiredError ? 'expired_token' : 'invalid_token',
        }),
      );
    } else {
      Logger.error((error as Error).stack);
      next(
        new ErrorWithStatus(
          500,
          'authorization_error',
          'Unknown error while trying to verify user status',
        ),
      );
    }
  }
};
