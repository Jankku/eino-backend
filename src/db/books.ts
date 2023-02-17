import { PoolClient, QueryConfig } from 'pg';
import { query } from './config';
import Book from './model/book';
import BookStatus from './model/bookstatus';
import DbBook from './model/dbbook';

const getAllBooks = async (username: string): Promise<DbBook[]> => {
  const getBooksQuery: QueryConfig = {
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
  };
  const { rows } = await query(getBooksQuery);
  return rows;
};

const getBookById = async (bookId: string, username: string): Promise<DbBook[]> => {
  const getBookQuery: QueryConfig = {
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
  };
  const { rows } = await query(getBookQuery);
  return rows;
};

const getBooksByStatus = async (username: string, status: BookStatus): Promise<DbBook[]> => {
  const getBooksByStatusQuery: QueryConfig = {
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
  };
  const { rows } = await query(getBooksByStatusQuery);
  return rows;
};

const postBook = async (client: PoolClient, b: Book): Promise<string> => {
  const insertBookQuery: QueryConfig = {
    text: `INSERT INTO books (isbn, title, author, publisher, image_url, pages, year, submitter)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING book_id`,
    values: [b.isbn, b.title, b.author, b.publisher, b.image_url, b.pages, b.year, b.submitter],
  };
  const { rows } = await client.query(insertBookQuery);
  return rows[0].book_id;
};

const getTop10BookTitles = async (username: string): Promise<string[]> => {
  const getTopBooksQuery: QueryConfig = {
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
  };
  const { rows }: { rows: { title: string }[] } = await query(getTopBooksQuery);
  return rows.map(({ title }) => title);
};

export { getAllBooks, getBookById, getBooksByStatus, postBook, getTop10BookTitles };
