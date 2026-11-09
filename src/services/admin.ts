import type { Request, NextFunction } from 'express';
import type { TypedResponse } from '../util/zod.ts';
import { success } from '../util/response.ts';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { db } from '../db/config.ts';
import { config } from '../config.ts';
import { setDiscordAuditProcessingEnabled } from './audit.ts';
import { getDiscordAuditStatus, updateDiscordAuditSettings } from '../db/discordaudit.ts';
import { addAudit, getAllAudits, getAuditsPage } from '../db/audit.ts';
import { paginationMode } from '../db/pagination.ts';
import { getAdminOverview } from '../db/admin.ts';
import { logError } from '../util/logger.ts';
import {
  findProfilePictureByUsername,
  getAllUsers,
  getUsersPage,
  getUserById,
  updateProfilePicturePath,
} from '../db/users.ts';
import type {
  createBulletinSchema,
  deleteBulletinSchema,
  deleteUserSchema,
  editBulletinSchema,
  editUserSchema,
  enableUserSchema,
  disableUserSchema,
  overviewSchema,
  auditQuerySchema,
  discordAuditSettingsSchema,
} from '../routes/admin/schema.ts';
import * as fs from 'node:fs/promises';
import {
  createBulletin,
  deleteBulletin,
  getAllBulletins,
  getBulletinsPage,
  getBulletinForAudit,
  insertBulletinUsers,
  updateBulletin,
  updateBulletinUsers,
} from '../db/bulletins.ts';

export const getOverview = async (
  _: Request,
  res: TypedResponse<typeof overviewSchema>,
  next: NextFunction,
) => {
  try {
    const overview = await db.tx({ mode: paginationMode }, (t) =>
      getAdminOverview(t, res.locals.input.query),
    );
    res.status(200).json(success([overview]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to get overview'));
  }
};

export const getUsers = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const { pagination } = res.locals;
    if (pagination) {
      const page = await db.tx({ mode: paginationMode }, (t) => getUsersPage(t, pagination));
      res.status(200).json(page);
      return;
    }
    const users = await db.task((t) => getAllUsers(t));
    res.status(200).json(success(users));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to get users'));
  }
};

export const getAuditLogs = async (
  _: Request,
  res: TypedResponse<typeof auditQuerySchema>,
  next: NextFunction,
) => {
  try {
    const { pagination } = res.locals;
    const securityEvents = res.locals.input.query.security_events;
    if (pagination) {
      const page = await db.tx({ mode: paginationMode }, (t) =>
        getAuditsPage(t, pagination, securityEvents),
      );
      res.status(200).json(page);
      return;
    }
    const audits = await db.task((t) => getAllAudits(t, securityEvents));
    res.status(200).json(success(audits));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to get audits'));
  }
};

export const editUser = async (
  _: Request,
  res: TypedResponse<typeof editUserSchema>,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
  const newUser = res.locals.input.body;
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
        actor_user_id: res.locals.userId,
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
      logError(error);
      next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to edit user'));
    }
  }
};

export const enableUser = async (
  _: Request,
  res: TypedResponse<typeof enableUserSchema>,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
  try {
    await db.tx('enableUser', async (t) => {
      const adminUser = await getUserById(t, res.locals.userId);
      const user = await getUserById(t, userId);
      if (adminUser.user_id === user.user_id) {
        throw new ErrorWithStatus(400, 'admin_error', 'You cannot enable yourself');
      }
      if (!user.disabled_on) return;
      await t.none('UPDATE users SET disabled_on = null WHERE user_id = $1', user.user_id);
      await addAudit(t, {
        actor_user_id: res.locals.userId,
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
      logError(error);
      next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to enable user'));
    }
  }
};

export const disableUser = async (
  _: Request,
  res: TypedResponse<typeof disableUserSchema>,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
  try {
    await db.tx('disableUser', async (t) => {
      const adminUser = await getUserById(t, res.locals.userId);
      const user = await getUserById(t, userId);
      if (adminUser.user_id === user.user_id) {
        throw new ErrorWithStatus(400, 'admin_error', 'You cannot disable yourself');
      }
      await t.none('UPDATE users SET disabled_on = NOW() WHERE user_id = $1', user.user_id);
      await addAudit(t, {
        actor_user_id: res.locals.userId,
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
      logError(error);
      next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to disable user'));
    }
  }
};

export const deleteUser = async (
  _: Request,
  res: TypedResponse<typeof deleteUserSchema>,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
  try {
    await db.tx('deleteUser', async (t) => {
      const adminUser = await getUserById(t, res.locals.userId);
      const user = await getUserById(t, userId);
      if (adminUser.user_id === user.user_id) {
        throw new ErrorWithStatus(400, 'admin_error', 'You cannot delete yourself');
      }
      await t.none('DELETE FROM users WHERE user_id = $1', user.user_id);
      await addAudit(t, {
        actor_user_id: res.locals.userId,
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
      logError(error);
      next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to delete user'));
    }
  }
};

export const getBulletins = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const { pagination } = res.locals;
    if (pagination) {
      const page = await db.tx({ mode: paginationMode }, (t) => getBulletinsPage(t, pagination));
      res.status(200).json(page);
      return;
    }
    const bulletins = await db.task('getBulletins', async (t) => await getAllBulletins(t));
    res.status(200).json(success(bulletins));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to get bulletins'));
  }
};

export const postBulletin = async (
  _: Request,
  res: TypedResponse<typeof createBulletinSchema>,
  next: NextFunction,
) => {
  const { visibleToUserIds, ...bulletin } = res.locals.input.body;
  try {
    await db.tx('postBulletin', async (t) => {
      const bulletinId = await createBulletin(t, bulletin);
      if (bulletin.visibility === 'user') {
        await insertBulletinUsers(t, { bulletinId, userIds: visibleToUserIds! });
      }
      await addAudit(t, {
        actor_user_id: res.locals.userId,
        username: res.locals.username,
        action: 'bulletin_created',
        table_name: 'bulletins',
        record_id: bulletinId,
        new_data: await getBulletinForAudit(t, bulletinId),
      });
    });
    res
      .status(200)
      .json(success([{ name: 'bulletin_created', message: 'Bulletin created successfully' }]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to create bulletin'));
  }
};

export const editBulletin = async (
  _: Request,
  res: TypedResponse<typeof editBulletinSchema>,
  next: NextFunction,
) => {
  const { bulletinId } = res.locals.input.params;
  const { visibleToUserIds, ...bulletin } = res.locals.input.body;
  try {
    await db.tx('editBulletin', async (t) => {
      const oldBulletin = await getBulletinForAudit(t, bulletinId);
      await updateBulletin(t, { bulletinId, bulletin });
      if (bulletin.visibility !== 'user') {
        await updateBulletinUsers(t, { bulletinId, userIds: [] });
      } else if (visibleToUserIds) {
        await updateBulletinUsers(t, { bulletinId, userIds: visibleToUserIds });
      }
      await addAudit(t, {
        actor_user_id: res.locals.userId,
        username: res.locals.username,
        action: 'bulletin_updated',
        table_name: 'bulletins',
        record_id: bulletinId,
        old_data: oldBulletin,
        new_data: await getBulletinForAudit(t, bulletinId),
      });
    });
    res
      .status(200)
      .json(success([{ name: 'bulletin_updated', message: 'Bulletin updated successfully' }]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to update bulletin'));
  }
};

export const removeBulletin = async (
  _: Request,
  res: TypedResponse<typeof deleteBulletinSchema>,
  next: NextFunction,
) => {
  const { bulletinId } = res.locals.input.params;
  try {
    await db.tx('deleteBulletin', async (t) => {
      const oldBulletin = await getBulletinForAudit(t, bulletinId);
      await deleteBulletin(t, bulletinId);
      await addAudit(t, {
        actor_user_id: res.locals.userId,
        username: res.locals.username,
        action: 'bulletin_deleted',
        table_name: 'bulletins',
        record_id: bulletinId,
        old_data: oldBulletin,
      });
    });
    res
      .status(200)
      .json(success([{ name: 'bulletin_deleted', message: 'Bulletin deleted successfully' }]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to create bulletin'));
  }
};

export const getDiscordIntegration = async (_: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const status = await db.task(getDiscordAuditStatus);
    res.status(200).json(success([status]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unable to get Discord integration status'));
  }
};

export const updateDiscordIntegration = async (
  _: Request,
  res: TypedResponse<typeof discordAuditSettingsSchema>,
  next: NextFunction,
) => {
  const update = res.locals.input.body;
  if (update.enabled === true && !config.DISCORD_AUDIT_LOG_WEBHOOK_URL) {
    next(new ErrorWithStatus(422, 'admin_error', 'Discord webhook URL is not configured'));
    return;
  }
  try {
    const status = await db.tx((t) => updateDiscordAuditSettings(t, update));
    setDiscordAuditProcessingEnabled(status.enabled);
    res.status(200).json(success([status]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'admin_error', 'Unable to update Discord integration settings'));
  }
};
