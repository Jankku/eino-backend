import { QueryArrayResult } from 'pg';
import Logger from '../util/logger';
import { query } from './config';

const getUserByUsername = (username: string, next: Function) => {
  const q = {
    text: 'SELECT * FROM users WHERE username = $1',
    values: [username],
  };

  try {
    query(q, (err: Error, result: QueryArrayResult) => {
      if (err) return Logger.error('Error executing query', err.stack);
      next(result.rows);
    });
  } catch (err) {
    Logger.error(err);
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
    Logger.error(err);
    return false;
  }
};

const deleteAllUsers = async () => {
  const q = {
    text: 'DELETE FROM users',
  };

  try {
    await query(q);
  } catch (err) {
    Logger.error(err);
  }
};

export {
  getUserByUsername,
  isUserUnique,
  deleteAllUsers,
};
