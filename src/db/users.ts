import Logger from '../util/logger';
import sendQuery from './config';

const getUserByUsername = (username: string, next: Function) => {
  const query = {
    text: 'SELECT * FROM users WHERE username = $1',
    values: [username],
  };

  try {
    sendQuery(query, (err: any, result: any) => {
      if (err) return console.error('Error executing query', err.stack);
      next(result.rows);
    });
  } catch (err) {
    Logger.error(err);
  }
};

const isUserUnique = async (username: string): Promise<boolean> => {
  const query = {
    text: 'SELECT id, username FROM users WHERE username = $1',
    values: [username],
  };

  try {
    const result = await sendQuery(query, null);
    return result.rows.length === 0;
  } catch (err) {
    Logger.error(err);
    return false;
  }
};

const deleteAllUsers = async () => {
  const query = {
    text: 'DELETE FROM users',
    values: [],
  };

  try {
    await sendQuery(query, null);
  } catch (err) {
    Logger.error(err);
  }
};

export { getUserByUsername, isUserUnique, deleteAllUsers };
