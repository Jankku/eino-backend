import Logger from '../util/logger';
import { query } from './config';
import Book from './model/book';
import BookStatus from './model/bookstatus';

const getBooksByStatus = async (username: string, status: BookStatus): Promise<any[]> => {
  const getBooksQuery = {
    text: 'SELECT * FROM user_book_list WHERE username = $1 AND status = $2',
    values: [username, status],
  };

  try {
    const result = await query(getBooksQuery);
    if (result?.rows.length > 0) return result.rows;
  } catch (err) {
    Logger.error(err.stack);
  }

  return [];
};

const postBook = async (b: Book): Promise<string> => {
  let bookId = '';
  const insertBookQuery = {
    text: 'INSERT INTO books (isbn, title, author, publisher, pages, year, submitter) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING book_id',
    values: [b.isbn, b.title, b.author, b.publisher, b.pages, b.year, b.submitter],
  };

  try {
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
