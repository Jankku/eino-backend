import { Request, NextFunction } from 'express';
import { TypedRequest, TypedResponse } from '../util/zod';
import { success } from '../util/response';
import { ErrorWithStatus } from '../util/errorhandler';
import { db } from '../db/config';
import { addAudit, getAllAudits } from '../db/audit';
import { Logger } from '../util/logger';
import {
  findProfilePictureByUsername,
  getAllUsers,
  getUserById,
  getUserByUsername,
  updateProfilePicturePath,
} from '../db/users';
import {
  createBulletinSchema,
  deleteBulletinSchema,
  deleteUserSchema,
  editUserSchema,
} from '../routes/admin/schema';
import * as fs from 'node:fs/promises';
import {
  createBulletin,
  deleteBulletin,
  getAllBulletins,
  insertBulletinUsers,
  updateBulletin,
  updateBulletinUsers,
} from '../db/bulletins';

export const getUsers = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const users = await db.task((t) => getAllUsers(t));
    res.status(200).json(success(users));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to get users'));
  }
};

export const getAuditLogs = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const audits = await db.task((t) => getAllAudits(t));
    res.status(200).json(success(audits));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to get audits'));
  }
};

export const editUser = async (
  req: TypedRequest<typeof editUserSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = req.params;
  const newUser = req.body;
  try {
    await db.tx('editUser', async (t) => {
      const currentUser = await getUserById(t, userId);
      const currentPfpPath = await findProfilePictureByUsername(t, currentUser.username);
      if (currentPfpPath && !newUser.profile_picture_path) {
        await updateProfilePicturePath(t, { username: currentUser.username, path: undefined });
        await fs.rm(currentPfpPath, { force: true });
      }
      await t.none(
        `UPDATE users
          SET username = $1, email = $2, email_verified_on = $3, role_id = $4, totp_enabled_on = $5
          WHERE user_id = $6`,
        [
          newUser.username,
          newUser.email || undefined,
          newUser.email_verified_on,
          newUser.role_id,
          newUser.totp_enabled_on,
          userId,
        ],
      );
      await addAudit(t, {
        username: adminUsername,
        action: 'account_updated',
        table_name: 'users',
        record_id: userId,
        old_data: { ...currentUser, password: undefined },
        new_data: { ...currentUser, ...newUser, password: undefined },
      });
    });
    res.status(200).json(success([{ name: 'user_updated', message: 'User updated successfully' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to edit user'));
    }
  }
};

export const enableUser = async (
  req: TypedRequest<typeof deleteUserSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = req.params;
  try {
    await db.tx('enableUser', async (t) => {
      const adminUser = await getUserByUsername(t, adminUsername);
      const user = await getUserById(t, userId);
      if (adminUser.user_id === user.user_id) {
        throw new ErrorWithStatus(400, 'admin_error', 'You cannot enable yourself');
      }
      if (!user.disabled_on) return;
      await t.none('UPDATE users SET disabled_on = null WHERE user_id = $1', user.user_id);
      await addAudit(t, {
        username: adminUsername,
        action: 'account_enabled',
        table_name: 'users',
        record_id: user.user_id,
      });
    });
    res.status(200).json(success([{ name: 'user_enabled', message: 'User enabled successfully' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to enable user'));
    }
  }
};

export const disableUser = async (
  req: TypedRequest<typeof deleteUserSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = req.params;
  try {
    await db.tx('disableUser', async (t) => {
      const adminUser = await getUserByUsername(t, adminUsername);
      const user = await getUserById(t, userId);
      if (adminUser.user_id === user.user_id) {
        throw new ErrorWithStatus(400, 'admin_error', 'You cannot disable yourself');
      }
      await t.none('UPDATE users SET disabled_on = NOW() WHERE user_id = $1', user.user_id);
      await addAudit(t, {
        username: adminUsername,
        action: 'account_disabled',
        table_name: 'users',
        record_id: user.user_id,
      });
    });
    res
      .status(200)
      .json(success([{ name: 'user_disabled', message: 'User disabled successfully' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to disable user'));
    }
  }
};

export const deleteUser = async (
  req: TypedRequest<typeof deleteUserSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = req.params;
  try {
    await db.tx('deleteUser', async (t) => {
      const adminUser = await getUserByUsername(t, adminUsername);
      const user = await getUserById(t, userId);
      if (adminUser.user_id === user.user_id) {
        throw new ErrorWithStatus(400, 'admin_error', 'You cannot delete yourself');
      }
      await t.none('DELETE FROM users WHERE user_id = $1', user.user_id);
      await addAudit(t, {
        username: adminUsername,
        action: 'account_deleted',
        table_name: 'users',
        record_id: user.user_id,
        old_data: { ...user, password: undefined },
      });
    });
    res.status(200).json(success([{ name: 'user_deleted', message: 'User deleted successfully' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error((error as Error).stack);
      next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to delete user'));
    }
  }
};

export const getBulletins = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const bulletins = await db.task('getBulletins', async (t) => await getAllBulletins(t));
    res.status(200).json(success(bulletins));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to get bulletins'));
  }
};

export const postBulletin = async (
  req: TypedRequest<typeof createBulletinSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { visibleToUserIds, ...bulletin } = req.body;
  try {
    await db.tx('postBulletin', async (t) => {
      const bulletinId = await createBulletin(t, bulletin);
      if (bulletin.visibility === 'user') {
        await insertBulletinUsers(t, { bulletinId, userIds: visibleToUserIds! });
      }
    });
    res
      .status(200)
      .json(success([{ name: 'bulletin_created', message: 'Bulletin created successfully' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to create bulletin'));
  }
};

export const editBulletin = async (
  req: TypedRequest<typeof createBulletinSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { bulletinId } = req.params;
  const { visibleToUserIds, ...bulletin } = req.body;
  try {
    await db.tx('editBulletin', async (t) => {
      await updateBulletin(t, { bulletinId, bulletin });
      if (bulletin.visibility === 'user') {
        await updateBulletinUsers(t, { bulletinId, userIds: visibleToUserIds! });
      }
    });
    res
      .status(200)
      .json(success([{ name: 'bulletin_updated', message: 'Bulletin updated successfully' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to update bulletin'));
  }
};

export const removeBulletin = async (
  req: TypedRequest<typeof deleteBulletinSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { bulletinId } = req.params;
  try {
    await db.tx('deleteBulletin', async (t) => await deleteBulletin(t, bulletinId));
    res
      .status(200)
      .json(success([{ name: 'bulletin_deleted', message: 'Bulletin deleted successfully' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to create bulletin'));
  }
};
