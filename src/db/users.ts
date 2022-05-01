import Logger from '../util/logger';
import { query } from './config';
import User from './model/user';
import { QueryConfig } from 'pg';

const getUserByUsername = async (username: string): Promise<User | undefined> => {
  const getUserQuery: QueryConfig = {
    text: `SELECT *
           FROM users
           WHERE username = $1`,
    values: [username],
  };

  try {
    const { rows } = await query(getUserQuery);
    return rows[0] as User;
  } catch (error) {
    Logger.error((error as Error).stack);
    return undefined;
  }
};

const isUserUnique = async (username: string): Promise<boolean> => {
  const isUniqueQuery: QueryConfig = {
    text: `SELECT username
           FROM users
           WHERE username = $1`,
    values: [username],
  };

  try {
    const { rows } = await query(isUniqueQuery);
    return rows.length === 0;
  } catch (error) {
    Logger.error((error as Error).stack);
    return false;
  }
};

// Used only for tests
const deleteAllUsers = () => {
  try {
    query({
      text: `DELETE
             FROM users`,
    });
  } catch (error) {
    Logger.error((error as Error).stack);
  }
};

export { getUserByUsername, isUserUnique, deleteAllUsers };
