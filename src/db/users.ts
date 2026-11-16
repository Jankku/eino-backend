import type { ITask } from 'pg-promise';
import { generatePasswordHash, verifyPassword } from '../util/password.ts';
import { logError } from '../util/logger.ts';
import { getProfilePicturePathByFileName } from '../util/profilepicture.ts';
import { roleIdToName } from '../util/role.ts';
import { getPage } from './pagination.ts';
import type { Pagination } from '../util/pagination.ts';

export type User = {
  user_id: string;
  username: string;
  password: string;
  role_id: number;
  role_modified_on: Date;
  profile_picture_path: string | null;
  email: string | null;
  email_verified_on: Date;
  disabled_on: Date;
  totp_enabled_on: Date;
  last_login_on: Date;
  created_on: Date;
};

type UserWithRoleName = Omit<User, 'password' | 'role_modified_on'> & {
  role: string;
  argon2id_migrated: boolean;
};

const usersQuery = `SELECT user_id, username, role_id, profile_picture_path, email, email_verified_on,
            disabled_on, totp_enabled_on, last_login_on, created_on,
            password LIKE '$argon2id$%' AS argon2id_migrated
     FROM users`;

export const getAllUsers = async (t: ITask<unknown>): Promise<UserWithRoleName[]> => {
  return await t.map<UserWithRoleName>(`${usersQuery} ORDER BY username ASC`, undefined, (row) => ({
    ...row,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    role: roleIdToName(row.role_id as number),
  }));
};

export const getUsersPage = async (t: ITask<unknown>, pagination: Pagination) => {
  const page = await getPage<Omit<UserWithRoleName, 'role'>>(t, {
    query: usersQuery,
    pagination,
    idColumn: 'user_id',
    listQuery: { sort: 'username', order: 'ascending' },
  });
  return {
    ...page,
    results: page.results.map((user) => ({ ...user, role: roleIdToName(user.role_id) })),
  };
};

export const findUserByCredential = async (
  t: ITask<unknown>,
  usernameOrEmail: string,
): Promise<User | null | undefined> => {
  return await t.oneOrNone({
    text: `SELECT *
           FROM users
           WHERE username = $1 OR (email = $1 AND email_verified_on IS NOT NULL)
           ORDER BY (username = $1) DESC
           LIMIT 1`,
    values: [usernameOrEmail],
  });
};

export const getUserById = async (t: ITask<unknown>, userId: string): Promise<User> => {
  return await t.one({
    text: `SELECT *
           FROM users
           WHERE user_id = $1`,
    values: [userId],
  });
};

export const findUserById = async (t: ITask<unknown>, userId: string): Promise<User | null> => {
  return await t.oneOrNone({
    text: `SELECT *
           FROM users
           WHERE user_id = $1`,
    values: [userId],
  });
};

export const findUserByIdForUpdate = async (
  t: ITask<unknown>,
  userId: string,
): Promise<User | null> => {
  return await t.oneOrNone({
    text: 'SELECT * FROM users WHERE user_id = $1 FOR UPDATE',
    values: [userId],
  });
};

export const getUserByIdForUpdate = async (t: ITask<unknown>, userId: string): Promise<User> => {
  return await t.one({
    text: 'SELECT * FROM users WHERE user_id = $1 FOR UPDATE',
    values: [userId],
  });
};

export const upgradePassword = async (
  t: ITask<unknown>,
  { userId, originalHash, newHash }: { userId: string; originalHash: string; newHash: string },
): Promise<void> => {
  const result = await t.result({
    text: 'UPDATE users SET password = $1 WHERE user_id = $2 AND password = $3',
    values: [newHash, userId, originalHash],
  });
  if (result.rowCount !== 1) throw new Error('Password upgrade could not be saved');
};

export const findUserByUsername = async (
  t: ITask<unknown>,
  username: string,
): Promise<User | null | undefined> => {
  return await t.oneOrNone({
    text: `SELECT *
           FROM users
           WHERE username = $1`,
    values: [username],
  });
};

export const findUserByEmailForUpdate = async (
  t: ITask<unknown>,
  email: string,
): Promise<User | null | undefined> => {
  return await t.oneOrNone({
    text: 'SELECT * FROM users WHERE email = $1 FOR UPDATE',
    values: [email],
  });
};

export const updateEmailAddress = async (
  t: ITask<unknown>,
  {
    userId,
    email,
  }: {
    userId: string;
    email: string | undefined | null;
  },
): Promise<void> => {
  await t.none({
    text: `UPDATE users
             SET email = $1, email_verified_on = NULL
             WHERE user_id = $2`,
    values: [email, userId],
  });
};

export const updateEmailVerifiedTimestamp = async (
  t: ITask<unknown>,
  email: string,
): Promise<void> => {
  await t.none({
    text: `UPDATE users
             SET email_verified_on = CURRENT_TIMESTAMP(0)
             WHERE email = $1`,
    values: [email],
  });
};

export const enableTOTP = async (t: ITask<unknown>, userId: string): Promise<void> => {
  await t.none({
    text: `UPDATE users SET totp_enabled_on = CURRENT_TIMESTAMP(0) WHERE user_id = $1`,
    values: [userId],
  });
};

export const disableTOTP = async (t: ITask<unknown>, userId: string): Promise<void> => {
  await t.none({
    text: `UPDATE users SET totp_enabled_on = NULL WHERE user_id = $1`,
    values: [userId],
  });
};

export const isEmailAlreadyUsed = async (
  t: ITask<unknown>,
  {
    userId,
    email,
  }: {
    userId: string;
    email: string;
  },
): Promise<boolean> => {
  const result = await t.oneOrNone({
    text: `SELECT email
           FROM users
           WHERE email = $1 AND user_id != $2`,
    values: [email, userId],
  });
  return result !== null;
};

export const isEmailVerified = async (t: ITask<unknown>, email: string): Promise<boolean> => {
  const result = await t.oneOrNone({
    text: `SELECT email_verified_on
           FROM users
           WHERE email = $1`,
    values: [email],
  });
  return !!result && result.email_verified_on !== null;
};

export const updatePassword = async (
  t: ITask<unknown>,
  {
    userId,
    newPassword,
  }: {
    userId: string;
    newPassword: string;
  },
): Promise<void> => {
  const hashedPassword = await generatePasswordHash(newPassword);
  await t.none({
    text: `UPDATE users
             SET password = $1
             WHERE user_id = $2`,
    values: [hashedPassword, userId],
  });
};

export const isPasswordCorrect = async (
  t: ITask<unknown>,
  { userId, password }: { userId: string; password: string },
): Promise<boolean> => {
  const user = await getUserById(t, userId);
  const isCorrect = await verifyPassword(password, user.password);
  return isCorrect;
};

export const isUserUnique = async (t: ITask<unknown>, username: string): Promise<boolean> => {
  try {
    const result = await t.result({
      text: `SELECT username
           FROM users
           WHERE username = $1`,
      values: [username],
    });
    return result.rowCount === 0;
  } catch (error) {
    logError(error);
    return false;
  }
};

export const isEmailUnique = async (t: ITask<unknown>, email: string): Promise<boolean> => {
  try {
    const result = await t.result({
      text: `SELECT email
           FROM users
           WHERE email = $1`,
      values: [email],
    });
    return result.rowCount === 0;
  } catch (error) {
    logError(error);
    return false;
  }
};

export const isEmailUniqueExcludeUserId = async (
  t: ITask<unknown>,
  userId: string,
  email: string,
): Promise<boolean> => {
  try {
    const result = await t.result<{ username: string; email: string }>({
      text: `SELECT username, email
           FROM users
           WHERE email = $1 AND user_id != $2`,
      values: [email, userId],
    });
    return result.rowCount === 0;
  } catch (error) {
    logError(error);
    return false;
  }
};

export const updateLastLogin = async (t: ITask<unknown>, userId: string): Promise<void> => {
  await t.none({
    text: `UPDATE users
             SET last_login_on = CURRENT_TIMESTAMP(0)
             WHERE user_id = $1`,
    values: [userId],
  });
};

type UserItemCount = {
  book_count: number;
  movie_count: number;
};

const getItemCountByUserId = async (t: ITask<unknown>, userId: string): Promise<UserItemCount> => {
  return await t.one({
    text: `SELECT
      (SELECT COUNT(*) FROM books WHERE user_id = $1) AS book_count,
      (SELECT COUNT(*) FROM movies WHERE user_id = $1) AS movie_count;`,
    values: [userId],
  });
};

export const getItemCountByUserIdForUpdate = async (
  t: ITask<unknown>,
  userId: string,
): Promise<UserItemCount> => {
  await t.one({
    text: 'SELECT user_id FROM users WHERE user_id = $1 FOR NO KEY UPDATE',
    values: [userId],
  });
  return await getItemCountByUserId(t, userId);
};

export const findProfilePictureByUserId = async (
  t: ITask<unknown>,
  userId: string,
): Promise<string | null> => {
  const result = await t.oneOrNone({
    text: `SELECT profile_picture_path
           FROM users
           WHERE user_id = $1`,
    values: [userId],
  });
  return result?.profile_picture_path;
};

export const findProfilePicturePathByFileName = async (
  t: ITask<unknown>,
  fileName: string,
): Promise<string | null> => {
  const result = await t.oneOrNone({
    text: `SELECT profile_picture_path
           FROM users
           WHERE profile_picture_path = $1`,
    values: [getProfilePicturePathByFileName(fileName)],
  });
  return result?.profile_picture_path;
};

export const updateProfilePicturePath = async (
  t: ITask<unknown>,
  { userId, path }: { userId: string; path: string | undefined },
): Promise<void> => {
  await t.none({
    text: `UPDATE users
             SET profile_picture_path = $1
             WHERE user_id = $2`,
    values: [path, userId],
  });
};
