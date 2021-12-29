import Logger from '../util/logger';
import { query } from './config';
import User from './model/user';

// eslint-disable-next-line @typescript-eslint/ban-types
const getUserByUsername = async (username: string, next: Function) => {
  const q = {
    text: `SELECT * FROM users WHERE username = $1`,
    values: [username],
  };

  try {
    const { rows } = await query(q);
    next(rows[0] as User);
  } catch (error) {
    Logger.error((error as Error).stack);
    next(error);
  }
};

const isUserUnique = async (username: string): Promise<boolean> => {
  const q = {
    text: `SELECT username FROM users WHERE username = $1`,
    values: [username],
  };

  try {
    const { rows } = await query(q);
    return rows.length === 0;
  } catch (error) {
    Logger.error((error as Error).stack);
    return false;
  }
};

// Used only for tests
const deleteAllUsers = () => {
  try {
    query({ text: `DELETE FROM users` });
  } catch (error) {
    Logger.error((error as Error).stack);
  }
};

export { getUserByUsername, isUserUnique, deleteAllUsers };
