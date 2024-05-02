import Logger from '../util/logger';
import { db } from './config';
import User from './model/user';
import * as bcrypt from 'bcrypt';

const getUserByUsername = async (username: string): Promise<User> => {
  return await db.one({
    text: `SELECT *
           FROM users
           WHERE username = $1`,
    values: [username],
  });
};

const updateEmailAddress = async (username: string, email: string | null): Promise<void> => {
  await db.none({
    text: `UPDATE users
             SET email = $1, email_verified_on = NULL
             WHERE username = $2`,
    values: [email, username],
  });
};

const isEmailVerified = async (email: string): Promise<boolean> => {
  const result = await db.oneOrNone({
    text: `SELECT email_verified_on
           FROM users
           WHERE email = $1`,
    values: [email],
  });
  if (!result) return false;
  return result.email_verified_on !== null;
};

const isPasswordCorrect = async (username: string, password: string): Promise<boolean> => {
  const user = await getUserByUsername(username);
  const isCorrect = await bcrypt.compare(password, user.password);
  return isCorrect;
};

const isUserUnique = async (username: string): Promise<boolean> => {
  try {
    const result = await db.result({
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

type UserItemCount = {
  username: string;
  book_count: number;
  movie_count: number;
};

const getItemCountByUsername = async (username: string): Promise<UserItemCount> => {
  return await db.one({
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

// Used only for tests
const deleteAllUsers = async () => {
  try {
    await db.none({
      text: `DELETE
             FROM users`,
    });
  } catch (error) {
    Logger.error((error as Error).stack);
  }
};

export {
  getUserByUsername,
  updateEmailAddress,
  isPasswordCorrect,
  isUserUnique,
  isEmailVerified,
  deleteAllUsers,
  getItemCountByUsername,
};
