import { QueryConfig } from 'pg';
import Logger from '../util/logger';
import { query } from './config';
import Book from './model/book';
import BookStatus from './model/bookstatus';

type DbBook = {
  book_id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pages: number;
  year: number;
  status: BookStatus;
  score: number;
  start_date: string;
  end_date: string;
  created_on: string;
};

const getAllBooks = async (username: string): Promise<DbBook[]> => {
  const getBooksQuery: QueryConfig = {
    text: `SELECT b.book_id,
                  b.isbn,
                  b.title,
                  b.author,
                  b.publisher,
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

  try {
    const { rows } = await query(getBooksQuery);
    return rows;
  } catch (error) {
    Logger.error((error as Error).stack);
    return [];
  }
};

const getBooksByStatus = async (username: string, status: BookStatus): Promise<DbBook[]> => {
  const getBooksByStatusQuery: QueryConfig = {
    text: `SELECT b.book_id,
                  b.isbn,
                  b.title,
                  b.author,
                  b.publisher,
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

  try {
    const { rows } = await query(getBooksByStatusQuery);
    return rows;
  } catch (error) {
    Logger.error((error as Error).stack);
    return [];
  }
};

const postBook = async (b: Book): Promise<string> => {
  let bookId = '';

  const insertBookQuery: QueryConfig = {
    text: `INSERT INTO books (isbn, title, author, publisher, pages, year, submitter)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING book_id`,
    values: [b.isbn, b.title, b.author, b.publisher, b.pages, b.year, b.submitter],
  };

  try {
    const { rows } = await query(insertBookQuery);
    bookId = rows[0].book_id;
  } catch (error) {
    Logger.error((error as Error).stack);
  }

  return bookId;
};

export { getAllBooks, getBooksByStatus, postBook };
