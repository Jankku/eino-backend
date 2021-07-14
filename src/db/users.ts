import Logger from '../util/logger';
import { query } from './config';
import User from './model/user';

const getUserByUsername = async (username: string, next: Function) => {
  const q = {
    text: 'SELECT * FROM users WHERE username = $1 LIMIT 1',
    values: [username],
  };

  try {
    const result = await query(q);
    next(result.rows[0] as User);
  } catch (err) {
    Logger.error(err.stack);
    next(undefined);
  }
};

const isUserUnique = async (username: string): Promise<boolean> => {
  const q = {
    text: 'SELECT user_id, username FROM users WHERE username = $1',
    values: [username],
  };

  try {
    const result = await query(q);
    return result.rows.length === 0;
  } catch (err) {
    Logger.error(err.stack);
    return false;
  }
};

const deleteAllUsers = () => {
  const q = {
    text: 'DELETE FROM users',
  };

  try {
    query(q);
  } catch (err) {
    Logger.error(err.stack);
  }
};

export {
  getUserByUsername,
  isUserUnique,
  deleteAllUsers,
};
