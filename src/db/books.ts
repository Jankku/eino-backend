import Book from './model/book';
import BookStatus from './model/bookstatus';
import DbBook from './model/dbbook';
import { ITask } from 'pg-promise';

export const getAllBooks = async (t: ITask<unknown>, username: string): Promise<DbBook[]> => {
  return await t.any({
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

export const getBookById = async (
  t: ITask<unknown>,
  { bookId, username }: { bookId: string; username: string },
): Promise<DbBook> => {
  return await t.one({
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

export const getBooksByStatus = async (
  t: ITask<unknown>,
  { username, status }: { username: string; status: BookStatus },
): Promise<DbBook[]> => {
  return await t.any({
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

export const postBook = async (t: ITask<unknown>, b: Book, submitter: string): Promise<string> => {
  const result = await t.one({
    text: `INSERT INTO books (isbn, title, author, publisher, image_url, pages, year, submitter)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING book_id`,
    values: [b.isbn, b.title, b.author, b.publisher, b.image_url, b.pages, b.year, submitter],
  });
  return result.book_id;
};

export const postBookToUserList = async (
  t: ITask<unknown>,
  bookId: string,
  b: Book,
  username: string,
): Promise<void> => {
  await t.none({
    text: `INSERT INTO user_book_list (book_id, username, status, score, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
    values: [bookId, username, b.status, b.score, b.start_date, b.end_date],
  });
};

export const getTop10BookTitles = async (
  t: ITask<unknown>,
  username: string,
): Promise<string[]> => {
  return await t.map(
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
