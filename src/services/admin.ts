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
import { deleteUserSchema, editUserSchema } from '../routes/admin/schema';
import * as fs from 'node:fs/promises';

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
    await db.tx(async (t) => {
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
    await db.tx(async (t) => {
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
    await db.tx(async (t) => {
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
    await db.tx(async (t) => {
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
