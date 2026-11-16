import type { NextFunction, Request } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { SecurityErrorWithStatus } from '../util/errorhandler.ts';
import { formatZodErrors, type TypedResponse } from '../util/zod.ts';
import { verifyTokenClaims } from '../util/auth.ts';
import { db } from '../db/config.ts';
import { findUserById } from '../db/users.ts';
import { roleIdToName } from '../util/role.ts';
import { auditSecurityFailureAfterResponse } from '../util/securityaudit.ts';

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
  const header = tokenSchema.safeParse(req);
  if (!header.success) {
    auditSecurityFailureAfterResponse(req, res, {
      operation: 'access_token',
      reason: 'invalid_authorization_header',
    });
    next(formatZodErrors(header.error));
    return;
  }

  const { userId, tokenVersion } = verifyTokenClaims(
    header.data.headers.authorization,
    config.ACCESS_TOKEN_SECRET,
    { name: 'authorization_error', operation: 'access_token' },
  );
  const user = await db.task((t) => findUserById(t, userId));
  if (!user) {
    throw new SecurityErrorWithStatus(401, 'authorization_error', 'Account no longer exists', {
      operation: 'access_token',
      reason: 'account_not_found',
      targetUserId: userId,
    });
  }
  if (user.token_version !== tokenVersion) {
    throw new SecurityErrorWithStatus(401, 'authorization_error', 'Token revoked', {
      operation: 'access_token',
      reason: 'revoked_token',
      targetUserId: userId,
    });
  }

  res.locals.userId = user.user_id;
  res.locals.username = user.username;
  res.locals.role = roleIdToName(user.role_id);
  res.locals.isDisabled = !!user.disabled_on;
  next();
};
