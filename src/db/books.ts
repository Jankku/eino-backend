import { QueryResult } from 'pg';
import Logger from '../util/logger';
import sendQuery from './config';
import Status from './model/status';

const getBooksByStatus = async (username: string, status: Status): Promise<any[]> => {
  try {
    const query = {
      text: 'SELECT * FROM user_book_list WHERE username = $1 AND status = $2',
      values: [username, status],
    };

    const result: QueryResult = await sendQuery(query, null);
    if (result.rows.length > 0) return result.rows;
  } catch (err) {
    Logger.error(err);
  }
  return [];
};

const addBook = () => {};

export {
  getBooksByStatus,
  addBook,
};
