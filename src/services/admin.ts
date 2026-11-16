import type { Request } from 'express';
import type { TypedResponse } from '../util/zod.ts';
import { success } from '../util/response.ts';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { db } from '../db/config.ts';
import { config } from '../config.ts';
import { setDiscordAuditProcessingEnabled } from './audit.ts';
import { getDiscordAuditStatus, updateDiscordAuditSettings } from '../db/discordaudit.ts';
import { addAudit, getAllAudits, getAuditsPage, redactUserAudits } from '../db/audit.ts';
import { paginationMode } from '../db/pagination.ts';
import { getAdminOverview } from '../db/admin.ts';
import {
  findProfilePictureByUserId,
  getAllUsers,
  getUsersPage,
  getUserById,
  findUserById,
  getUserByIdForUpdate,
  incrementTokenVersion,
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
  revokeUserSessionsSchema,
  auditQuerySchema,
  discordAuditSettingsSchema,
} from '../routes/admin/schema.ts';
import { removeRetiredProfilePicture } from '../util/profilepicture.ts';
import { removeShareImage } from '../util/share.ts';
import { deleteVerifications } from '../db/verification.ts';
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

export const getOverview = async (_: Request, res: TypedResponse<typeof overviewSchema>) => {
  const overview = await db.tx({ mode: paginationMode }, (t) =>
    getAdminOverview(t, res.locals.input.query),
  );
  res.status(200).json(success([overview]));
};

export const getUsers = async (_: Request, res: TypedResponse) => {
  const { pagination } = res.locals;
  if (pagination) {
    const page = await db.tx({ mode: paginationMode }, (t) => getUsersPage(t, pagination));
    res.status(200).json(page);
    return;
  }
  const users = await db.task((t) => getAllUsers(t));
  res.status(200).json(success(users));
};

export const getAuditLogs = async (_: Request, res: TypedResponse<typeof auditQuerySchema>) => {
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
};

export const editUser = async (_: Request, res: TypedResponse<typeof editUserSchema>) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
  const newUser = res.locals.input.body;
  const retiredPfpPath = await db.tx('editUser', async (t) => {
    const currentUser = await getUserByIdForUpdate(t, userId);

    // 2FA can only be enabled by the user, who must confirm a generated secret.
    // Enabling it here would require a code for which the user has no secret.
    if (!currentUser.totp_enabled_on && newUser.totp_enabled_on) {
      throw new ErrorWithStatus(422, 'admin_error', "2FA can't be enabled by an admin");
    }
    const disables2FA = Boolean(currentUser.totp_enabled_on) && !newUser.totp_enabled_on;
    if (disables2FA) {
      await deleteVerifications(t, { userId, type: '2fa' });
    }

    const currentPfpPath = await findProfilePictureByUserId(t, userId);
    let retiredPath: string | undefined;
    if (currentPfpPath && !newUser.profile_picture_path) {
      await updateProfilePicturePath(t, { userId, path: undefined });
      retiredPath = currentPfpPath;
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
        // An enabled timestamp records when the user confirmed 2FA and is kept as is.
        disables2FA ? undefined : currentUser.totp_enabled_on,
        userId,
      ],
    );
    // Tokens carry the role and 2FA state, so earlier tokens would keep the old values.
    if (disables2FA || newUser.role_id !== currentUser.role_id) {
      await incrementTokenVersion(t, userId);
    }
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username: adminUsername,
      action: 'account_updated',
      table_name: 'users',
      record_id: userId,
      old_data: { ...currentUser, password: undefined },
      new_data: {
        ...currentUser,
        ...newUser,
        totp_enabled_on: disables2FA ? undefined : currentUser.totp_enabled_on,
        password: undefined,
      },
    });
    return retiredPath;
  });
  // Removed only after the commit, so a failed transaction keeps a valid reference.
  if (retiredPfpPath) {
    await removeRetiredProfilePicture(retiredPfpPath);
  }
  res.status(200).json(success([{ name: 'user_updated', message: 'User updated successfully' }]));
};

export const enableUser = async (_: Request, res: TypedResponse<typeof enableUserSchema>) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
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
};

export const disableUser = async (_: Request, res: TypedResponse<typeof disableUserSchema>) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
  await db.tx('disableUser', async (t) => {
    const adminUser = await getUserById(t, res.locals.userId);
    const user = await getUserById(t, userId);
    if (adminUser.user_id === user.user_id) {
      throw new ErrorWithStatus(400, 'admin_error', 'You cannot disable yourself');
    }
    await t.none('UPDATE users SET disabled_on = NOW() WHERE user_id = $1', user.user_id);
    // Re-enabling the account later must not bring back sessions from before.
    await incrementTokenVersion(t, user.user_id);
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username: adminUsername,
      action: 'account_disabled',
      table_name: 'users',
      record_id: user.user_id,
    });
  });
  res.status(200).json(success([{ name: 'user_disabled', message: 'User disabled successfully' }]));
};

export const revokeUserSessions = async (
  _: Request,
  res: TypedResponse<typeof revokeUserSessionsSchema>,
) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
  await db.tx('revokeUserSessions', async (t) => {
    const user = await findUserById(t, userId);
    if (!user) {
      throw new ErrorWithStatus(404, 'admin_error', 'User not found');
    }
    await incrementTokenVersion(t, user.user_id);
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username: adminUsername,
      action: 'sessions_revoked',
      table_name: 'users',
      record_id: user.user_id,
    });
  });
  res
    .status(200)
    .json(success([{ name: 'sessions_revoked', message: 'User sessions revoked successfully' }]));
};

export const deleteUser = async (_: Request, res: TypedResponse<typeof deleteUserSchema>) => {
  const adminUsername = res.locals.username;
  const { userId } = res.locals.input.params;
  const profilePicturePath = await db.tx('deleteUser', async (t) => {
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
    });
    await redactUserAudits(t, user.user_id);
    return user.profile_picture_path;
  });
  // Files are removed only after the deletion commits.
  await removeShareImage(userId);
  if (profilePicturePath) {
    await removeRetiredProfilePicture(profilePicturePath);
  }
  res.status(200).json(success([{ name: 'user_deleted', message: 'User deleted successfully' }]));
};

export const getBulletins = async (_: Request, res: TypedResponse) => {
  const { pagination } = res.locals;
  if (pagination) {
    const page = await db.tx({ mode: paginationMode }, (t) => getBulletinsPage(t, pagination));
    res.status(200).json(page);
    return;
  }
  const bulletins = await db.task('getBulletins', async (t) => await getAllBulletins(t));
  res.status(200).json(success(bulletins));
};

export const postBulletin = async (_: Request, res: TypedResponse<typeof createBulletinSchema>) => {
  const { visibleToUserIds, ...bulletin } = res.locals.input.body;
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
};

export const editBulletin = async (_: Request, res: TypedResponse<typeof editBulletinSchema>) => {
  const { bulletinId } = res.locals.input.params;
  const { visibleToUserIds, ...bulletin } = res.locals.input.body;
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
};

export const removeBulletin = async (
  _: Request,
  res: TypedResponse<typeof deleteBulletinSchema>,
) => {
  const { bulletinId } = res.locals.input.params;
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
};

export const getDiscordIntegration = async (_: Request, res: TypedResponse) => {
  const status = await db.task(getDiscordAuditStatus);
  res.status(200).json(success([status]));
};

export const updateDiscordIntegration = async (
  _: Request,
  res: TypedResponse<typeof discordAuditSettingsSchema>,
) => {
  const update = res.locals.input.body;
  if (update.enabled === true && !config.DISCORD_AUDIT_LOG_WEBHOOK_URL) {
    throw new ErrorWithStatus(422, 'admin_error', 'Discord webhook URL is not configured');
  }
  const status = await db.tx((t) => updateDiscordAuditSettings(t, update));
  setDiscordAuditProcessingEnabled(status.enabled);
  res.status(200).json(success([status]));
};
