import { ITask } from 'pg-promise';
import { generatePasswordHash } from '../util/auth';
import Logger from '../util/logger';
import User from './model/user';
import * as bcrypt from 'bcrypt';

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
    email: string | null;
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
