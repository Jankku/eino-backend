import { ITask } from 'pg-promise';
import { generatePasswordHash } from '../util/auth';
import { Logger } from '../util/logger';
import * as bcrypt from 'bcrypt';
import { getProfilePicturePathByFileName } from '../util/profilepicture';
import { roleIdToName } from '../util/role';

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

export type UserWithRoleName = User & { role: string };

export const getAllUsers = async (t: ITask<unknown>): Promise<UserWithRoleName[]> => {
  return await t.map(
    'SELECT user_id, username, role_id, profile_picture_path, email, email_verified_on, disabled_on, totp_enabled_on, last_login_on, created_on FROM users ORDER BY username ASC',
    undefined,
    (row) => ({ ...row, role: roleIdToName(row.role_id as number) }),
  );
};

export const findUserByCredential = async (
  t: ITask<unknown>,
  usernameOrEmail: string,
): Promise<User | null | undefined> => {
  return await t.oneOrNone({
    text: `SELECT *
           FROM users
           WHERE username = $1 OR email = $1`,
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

export const getUserByUsername = async (t: ITask<unknown>, username: string): Promise<User> => {
  return await t.one({
    text: `SELECT *
           FROM users
           WHERE username = $1`,
    values: [username],
  });
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

export const getUserByEmail = async (t: ITask<unknown>, email: string): Promise<User> => {
  return await t.one({
    text: `SELECT *
           FROM users
           WHERE email = $1`,
    values: [email],
  });
};

export const findUserByEmail = async (
  t: ITask<unknown>,
  email: string,
): Promise<User | null | undefined> => {
  return await t.oneOrNone({
    text: `SELECT *
           FROM users
           WHERE email = $1`,
    values: [email],
  });
};

export const updateEmailAddress = async (
  t: ITask<unknown>,
  {
    username,
    email,
  }: {
    username: string;
    email: string | undefined | null;
  },
): Promise<void> => {
  await t.none({
    text: `UPDATE users
             SET email = $1, email_verified_on = NULL
             WHERE username = $2`,
    values: [email, username],
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

export const enableTOTP = async (t: ITask<unknown>, username: string): Promise<void> => {
  await t.none({
    text: `UPDATE users SET totp_enabled_on = CURRENT_TIMESTAMP(0) WHERE username = $1`,
    values: [username],
  });
};

export const disableTOTP = async (t: ITask<unknown>, username: string): Promise<void> => {
  await t.none({
    text: `UPDATE users SET totp_enabled_on = NULL WHERE username = $1`,
    values: [username],
  });
};

export const isEmailAlreadyUsed = async (
  t: ITask<unknown>,
  {
    username,
    email,
  }: {
    username: string;
    email: string;
  },
): Promise<boolean> => {
  const result = await t.oneOrNone({
    text: `SELECT email
           FROM users
           WHERE email = $1 AND username != $2`,
    values: [email, username],
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
  if (!result) return false;
  return result.email_verified_on !== null;
};

export const updatePassword = async (
  t: ITask<unknown>,
  {
    email,
    newPassword,
  }: {
    email: string;
    newPassword: string;
  },
): Promise<void> => {
  const hashedPassword = await generatePasswordHash(newPassword);
  await t.none({
    text: `UPDATE users
             SET password = $1
             WHERE email = $2`,
    values: [hashedPassword, email],
  });
};

export const isPasswordCorrect = async (
  t: ITask<unknown>,
  { username, password }: { username: string; password: string },
): Promise<boolean> => {
  const user = await getUserByUsername(t, username);
  const isCorrect = await bcrypt.compare(password, user.password);
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
    Logger.error((error as Error).stack);
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
    Logger.error((error as Error).stack);
    return false;
  }
};

export const isEmailUniqueExcludeUsername = async (
  t: ITask<unknown>,
  username: string,
  email: string,
): Promise<boolean> => {
  try {
    const result = await t.result<{ username: string; email: string }>({
      text: `SELECT username, email
           FROM users
           WHERE email = $1 AND username != $2`,
      values: [email, username],
    });
    return result.rowCount === 0;
  } catch (error) {
    Logger.error((error as Error).stack);
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
  username: string;
  book_count: number;
  movie_count: number;
};

export const getItemCountByUsername = async (
  t: ITask<unknown>,
  username: string,
): Promise<UserItemCount> => {
  return await t.one({
    text: `SELECT 
      $1 AS username, 
      COALESCE(b.book_count, 0) AS book_count,
      COALESCE(m.movie_count, 0) AS movie_count
    FROM 
      (
        SELECT COUNT(*) AS book_count 
        FROM books 
        WHERE submitter = $1
      ) b
    LEFT JOIN 
      (
        SELECT COUNT(*) AS movie_count 
        FROM movies 
        WHERE submitter = $1
      ) m ON TRUE;`,
    values: [username],
  });
};

export const findProfilePictureByUsername = async (
  t: ITask<unknown>,
  username: string,
): Promise<string | null> => {
  const result = await t.oneOrNone({
    text: `SELECT profile_picture_path
           FROM users
           WHERE username = $1`,
    values: [username],
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
  { username, path }: { username: string; path: string | undefined },
): Promise<void> => {
  await t.none({
    text: `UPDATE users
             SET profile_picture_path = $1
             WHERE username = $2`,
    values: [path, username],
  });
};
