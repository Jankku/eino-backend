import { db } from './config';
import Book from './model/book';
import BookStatus from './model/bookstatus';
import DbBook from './model/dbbook';
import { ITask } from 'pg-promise';

const getAllBooks = async (username: string, client?: ITask<unknown>): Promise<DbBook[]> => {
  const c = client || db;
  return await c.any({
    text: `SELECT b.book_id,
                  b.isbn,
                  b.title,
                  b.author,
                  b.publisher,
                  b.image_url,
                  b.pages,
                  b.year,
                  ubl.status,
                  ubl.score,
                  ubl.start_date,
                  ubl.end_date,
                  ubl.created_on
           FROM user_book_list ubl
                    INNER JOIN books b USING (book_id)
           WHERE ubl.username = b.submitter
             AND ubl.username = $1
             AND b.submitter = $1
           ORDER BY b.title`,
    values: [username],
  });
};

const getBookById = async (bookId: string, username: string): Promise<DbBook[]> => {
  return await db.any({
    text: `SELECT b.book_id,
                  b.isbn,
                  b.title,
                  b.author,
                  b.publisher,
                  b.image_url,
                  b.pages,
                  b.year,
                  ubl.status,
                  ubl.score,
                  ubl.start_date,
                  ubl.end_date,
                  ubl.created_on
           FROM user_book_list ubl,
                books b
           WHERE ubl.book_id = b.book_id
             AND ubl.book_id = $1
             AND b.submitter = $2`,
    values: [bookId, username],
  });
};

const getBooksByStatus = async (username: string, status: BookStatus): Promise<DbBook[]> => {
  return await db.any({
    text: `SELECT b.book_id,
                  b.isbn,
                  b.title,
                  b.author,
                  b.publisher,
                  b.image_url,
                  b.pages,
                  b.year,
                  ubl.status,
                  ubl.score,
                  ubl.start_date,
                  ubl.end_date,
                  ubl.created_on
           FROM user_book_list ubl
                    INNER JOIN books b USING (book_id)
           WHERE ubl.username = b.submitter
             AND ubl.username = $1
             AND ubl.status = $2
           ORDER BY b.title`,
    values: [username, status],
  });
};

const postBook = async (client: ITask<unknown>, b: Book, submitter: string): Promise<string> => {
  const result = await client.one({
    text: `INSERT INTO books (isbn, title, author, publisher, image_url, pages, year, submitter)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING book_id`,
    values: [b.isbn, b.title, b.author, b.publisher, b.image_url, b.pages, b.year, submitter],
  });
  return result.book_id;
};

const postBookToUserList = async (
  client: ITask<unknown>,
  bookId: string,
  b: Book,
  username: string,
): Promise<void> => {
  await client.none({
    text: `INSERT INTO user_book_list (book_id, username, status, score, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
    values: [bookId, username, b.status, b.score, b.start_date, b.end_date],
  });
};

const getTop10BookTitles = async (username: string): Promise<string[]> => {
  return await db.map(
    {
      text: `SELECT CASE
                WHEN char_length(b.title) > 25
                  THEN concat(left(b.title, 22), '...')
                  ELSE b.title
              END
            FROM user_book_list ubl
                    INNER JOIN books b USING (book_id)
            WHERE ubl.username = b.submitter
              AND ubl.username = $1
              AND ubl.status = 'completed'
            ORDER BY ubl.score DESC,
                      ubl.end_date DESC
            LIMIT 10;`,
      values: [username],
    },
    undefined,
    (row) => row.title,
  );
};

export {
  getAllBooks,
  getBookById,
  getBooksByStatus,
  postBook,
  postBookToUserList,
  getTop10BookTitles,
};
