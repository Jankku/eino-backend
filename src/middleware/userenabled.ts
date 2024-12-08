import { Request, NextFunction } from 'express';
import { TypedResponse } from '../util/zod';
import { ErrorWithStatus } from '../util/errorhandler';
import { getUserByUsername } from '../db/users';
import { db } from '../db/config';
import { Logger } from '../util/logger';
import { LRUCache } from 'lru-cache';

const userIsDisabledCache = new LRUCache<string, boolean>({
  allowStale: false,
  ttl: 1000 * 60 * 1,
  ttlAutopurge: true,
});

/**
 * Use after verifyToken middleware
 */
export const userEnabled = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const username = res.locals.username;
    const cachedIsDisabled = userIsDisabledCache.get(username);
    if (cachedIsDisabled === true) {
      throw new ErrorWithStatus(403, 'account_disabled', 'Your account is disabled');
    } else if (cachedIsDisabled === false) {
      next();
      return;
    }
    await db.task(async (t) => {
      const user = await getUserByUsername(t, username);
      userIsDisabledCache.set(username, !!user.disabled_on);
      if (user.disabled_on) {
        throw new ErrorWithStatus(403, 'account_disabled', 'Your account is disabled');
      }
    });
    next();
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
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
