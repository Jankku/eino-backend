import { Request, NextFunction } from 'express';
import { TypedRequest, TypedResponse } from '../util/zod';
import { success } from '../util/response';
import { ErrorWithStatus } from '../util/errorhandler';
import { db } from '../db/config';
import { addAudit, getAllAudits } from '../db/audit';
import { Logger } from '../util/logger';
import { getAllUsers, getUserById } from '../db/users';
import { deleteUserSchema } from '../routes/admin/schema';

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

export const deleteUser = async (
  req: TypedRequest<typeof deleteUserSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const adminUsername = res.locals.username;
  const { userId } = req.params;
  try {
    await db.tx(async (t) => {
      const user = await getUserById(t, userId);
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
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'admin_error', 'Unknown error while trying to delete user'));
  }
};
