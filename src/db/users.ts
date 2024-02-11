import Logger from '../util/logger';
import { db } from './config';
import User from './model/user';
import * as bcrypt from 'bcrypt';

const getUserByUsername = async (username: string): Promise<User | undefined> => {
  return await db.one({
    text: `SELECT *
           FROM users
           WHERE username = $1`,
    values: [username],
  });
};

const isPasswordCorrect = async (username: string, password: string): Promise<boolean> => {
  const user = await getUserByUsername(username);
  if (user === undefined) return false;

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

// Used only for tests
const deleteAllUsers = () => {
  try {
    db.none({
      text: `DELETE
             FROM users`,
    });
  } catch (error) {
    Logger.error((error as Error).stack);
  }
};

export { getUserByUsername, isPasswordCorrect, isUserUnique, deleteAllUsers };
