import Logger from '../util/logger';
import { query } from './config';
import User from './model/user';

const getUserByUsername = async (username: string, next: Function) => {
  const q = {
    text: 'SELECT * FROM users WHERE username = $1',
    values: [username],
  };

  try {
    const { rows } = await query(q);
    next(rows[0] as User);
  } catch (err: any) {
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
    const { rows } = await query(q);
    return rows.length === 0;
  } catch (err: any) {
    Logger.error(err.stack);
    return false;
  }
};

// Used only for tests
const deleteAllUsers = () => {
  try {
    query({ text: 'DELETE FROM users' });
  } catch (err: any) {
    Logger.error(err.stack);
  }
};

export {
  getUserByUsername,
  isUserUnique,
  deleteAllUsers,
};
