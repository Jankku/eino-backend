import { Request, NextFunction } from 'express';
import { TypedResponse } from '../util/zod';
import { success } from '../util/response';
import { ErrorWithStatus } from '../util/errorhandler';
import { db } from '../db/config';
import { Logger } from '../util/logger';
import { getPublicBulletins, getUserBulletins } from '../db/bulletins';

export const publicBulletins = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const bulletins = await db.task(async (t) => await getPublicBulletins(t));
    res.status(200).json(success(bulletins));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'bulletin_error', 'Unknown error while trying to get bulletins'));
  }
};

export const userBulletins = async (_: Request, res: TypedResponse, next: NextFunction) => {
  const username = res.locals.username;
  try {
    const bulletins = await db.task(async (t) => {
      let bulletins = await getPublicBulletins(t);
      if (username) {
        const userBulletins = await getUserBulletins(t, { username });
        bulletins = [...bulletins, ...userBulletins];
      }
      return bulletins;
    });

    res.status(200).json(success(bulletins));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'bulletin_error', 'Unknown error while trying to get bulletins'));
  }
};
