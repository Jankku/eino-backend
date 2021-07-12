import Logger from '../util/logger';
import { query } from './config';
import Book from './model/book';
import Status from './model/status';

const getBooksByStatus = async (username: string, status: Status): Promise<any[]> => {
  const q = {
    text: 'SELECT * FROM user_book_list WHERE username = $1 AND status = $2',
    values: [username, status],
  };

  try {
    const result = await query(q, null);
    if (result?.rows.length > 0) return result.rows;
  } catch (err) {
    Logger.error(err.stack);
  }

  return [];
};

const postBook = async (book: Book): Promise<string> => {
  let bookId = '';
  try {
    const insertBookQuery = {
      text: 'INSERT INTO books (title, author, publisher, isbn, pages, submitter) VALUES ($1, $2, $3, $4, $5, $6) RETURNING book_id',
      values: [book.title, book.author, book.publisher, book.isbn, book.pages, book.submitter],
    };
    const result = await query(insertBookQuery);
    bookId = result.rows[0].book_id;
  } catch (err) {
    Logger.error(err.stack);
  }

  return bookId;
};

export {
  getBooksByStatus,
  postBook,
};
