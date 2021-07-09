import Logger from '../util/logger';
import { query } from './config';
import Book from './model/book';
import Status from './model/status';

const getBooksByStatus = async (username: string, status: Status): Promise<any[]> => {
  try {
    const q = {
      text: 'SELECT * FROM user_book_list WHERE username = $1 AND status = $2',
      values: [username, status],
    };

    const result = await query(q, null);
    if (result?.rows.length > 0) return result.rows;
  } catch (err) {
    Logger.error(err);
  }

  return [];
};

const postBook = async (book: Book): Promise<string> => {
  let bookId = '';
  try {
    const insertBookQuery = {
      text: 'INSERT INTO books (title, author, publisher, isbn, pages, submitter) VALUES ($1, $2, $3, $4, $5, $6)',
      values: [book.title, book.author, book.publisher, book.isbn, book.pages, book.submitter],
    };
    await query(insertBookQuery)
      .then(async () => {
        // Get book ID and return it
        const getBookIdQuery = {
          text: 'SELECT book_id FROM books WHERE title = $1 AND submitter = $2 LIMIT 1',
          values: [book.title, book.submitter],
        };
        const bookIdResult = await query(getBookIdQuery);
        bookId = bookIdResult.rows[0].book_id;
      });
  } catch (err) {
    Logger.error(err);
  }

  return bookId;
};

export {
  getBooksByStatus,
  postBook,
};
