import { Request, NextFunction } from 'express';
import { TypedResponse } from '../util/zod';
import { success } from '../util/response';
import { ErrorWithStatus } from '../util/errorhandler';
import { db } from '../db/config';
import { Logger } from '../util/logger';
import {
  BulletinCondition,
  getConditionBulletins,
  getPublicBulletins,
  getUserBulletins,
} from '../db/bulletins';
import { getUserById } from '../db/users';
import { DateTime } from 'luxon';

export const publicBulletins = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const bulletins = await db.task('publicBulletins', async (t) => await getPublicBulletins(t));
    res.status(200).json(success(bulletins));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'bulletin_error', 'Unknown error while trying to get bulletins'));
  }
};

export const userBulletins = async (_: Request, res: TypedResponse, next: NextFunction) => {
  const userId = res.locals.userId;
  try {
    const bulletins = await db.task('userBulletins', async (t) => {
      let bulletins = await getPublicBulletins(t);

      const userBulletins = await getUserBulletins(t, userId);
      bulletins = [...bulletins, ...userBulletins];

      const conditionBulletins = await getConditionBulletins(t);
      if (conditionBulletins.length === 0) return bulletins;

      const user = await getUserById(t, userId);

      const isConditionMet = (condition: BulletinCondition | null): boolean => {
        switch (condition) {
          case '2fa_not_enabled': {
            return !user.totp_enabled_on;
          }
          case 'email_not_verified': {
            return Boolean(user.email && !user.email_verified_on);
          }
          case 'account_anniversary': {
            const diff = DateTime.now().diff(DateTime.fromJSDate(user.created_on), 'days');
            return Math.trunc(diff.days) % 365 === 0;
          }
          default: {
            Logger.warn(`Unknown bulletin condition: ${condition}`);
            return false;
          }
        }
      };

      const applicableConditionBulletins = conditionBulletins.filter(({ condition }) =>
        isConditionMet(condition),
      );
      bulletins = [...bulletins, ...applicableConditionBulletins];

      return bulletins;
    });

    res.status(200).json(success(bulletins));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'bulletin_error', 'Unknown error while trying to get bulletins'));
  }
};
