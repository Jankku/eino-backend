import { NextFunction, Request, Response } from 'express';
import { QueryConfig } from 'pg';
import Logger from '../util/logger';
import { getAllBooks, getBooksByStatus, postBook } from '../db/books';
import { success } from '../util/response';
import BookStatus from '../db/model/bookstatus';
import Book from '../db/model/book';
import { query } from '../db/config';
import { ErrorWithStatus } from '../util/errorhandler';
import BookSearchResult from '../db/model/booksearchresult';

const getBookById = async (req: Request, res: Response, next: NextFunction) => {
  const { bookId } = req.params;
  const { username } = res.locals;

  const getBookQuery: QueryConfig = {
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
           FROM user_book_list ubl,
                books b
           WHERE ubl.book_id = b.book_id
             AND ubl.book_id = $1
             AND b.submitter = $2`,
    values: [bookId, username],
  };

  try {
    const result = await query(getBookQuery);

    if (result.rowCount === 0) {
      next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find book"));
      return;
    }

    res.status(200).json(success(result.rows));
  } catch (error) {
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find book"));
  }
};

const fetchAllBooks = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const books = await getAllBooks(username);
    res.status(200).json(success(books));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find books"));
  }
};

const fetchListByStatus = async (
  req: Request,
  res: Response,
  status: BookStatus,
  next: NextFunction
) => {
  const { username } = res.locals;

  try {
    const books = await getBooksByStatus(username, status);
    res.status(200).json(success(books));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find books"));
  }
};

const getFullList = (req: Request, res: Response, next: NextFunction) =>
  fetchAllBooks(req, res, next);

const addBookToList = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const { isbn, title, author, publisher, pages, year, status, score, start_date, end_date } =
    req.body;
  const book: Book = {
    isbn,
    title,
    author,
    publisher,
    pages,
    year,
    submitter: username,
  };

  try {
    // Insert book to books table
    const bookId = await postBook(book);

    // Insert book to user's booklist
    const addBookToUserListQuery: QueryConfig = {
      text: `INSERT INTO user_book_list (book_id, username, status, score, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
      values: [bookId, username, status, score, start_date, end_date],
    };
    await query(addBookToUserListQuery);

    res.status(201).json(success([{ name: 'book_added_to_list', message: 'Book added to list' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't create book"));
  }
};

const updateBook = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const { bookId } = req.params;
  const { isbn, title, author, publisher, pages, year, status, score, start_date, end_date } =
    req.body;

  const updateBookQuery: QueryConfig = {
    text: `UPDATE books
           SET title=$1,
               author=$2,
               publisher=$3,
               pages=$4,
               isbn=$5,
               year=$6
           WHERE book_id = $7
             AND submitter = $8
           RETURNING book_id, title, author, publisher, pages, isbn, year`,
    values: [title, author, publisher, pages, isbn, year, bookId, username],
  };

  const updateUserListQuery: QueryConfig = {
    text: `UPDATE user_book_list
           SET status=$1,
               score=$2,
               start_date=$3,
               end_date=$4
           WHERE book_id = $5`,
    values: [status, score, start_date, end_date, bookId],
  };

  try {
    await query(updateBookQuery);
    await query(updateUserListQuery);
    res.status(200).json(success([{ name: 'book_updated', message: 'Book successfully updated' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't update book"));
  }
};

const deleteBook = async (req: Request, res: Response, next: NextFunction) => {
  const { bookId } = req.params;
  const { username } = res.locals;

  const deleteBookQuery: QueryConfig = {
    text: `DELETE
           FROM books
           WHERE book_id = $1
             AND submitter = $2`,
    values: [bookId, username],
  };

  try {
    const { rowCount } = await query(deleteBookQuery);

    if (rowCount === 0) {
      next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find book"));
      return;
    }

    res.status(200).json(success([{ name: 'book_deleted', message: 'Book deleted' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't delete book"));
  }
};

const searchBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryString = String(req.query.query).trim();
    const queryAsArray = queryString.split(' ');
    const { username } = res.locals;
    const resultArray: BookSearchResult[] = [];

    for (const queryPart of queryAsArray) {
      const searchQuery: QueryConfig = {
        text: `SELECT b.book_id, b.title, b.author, b.publisher, ubl.score
               FROM books b INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
               WHERE document @@ to_tsquery('english', $2)
                 AND submitter = $1
               ORDER BY ts_rank(document, plainto_tsquery($2)) DESC;`,
        values: [username, `${queryPart}:*`],
      };

      const { rows } = await query(searchQuery);
      rows.forEach((row) => {
        if (!resultArray.some((item) => item.book_id === row.book_id)) {
          resultArray.push(row);
        }
      });
    }

    if (resultArray.length === 0) {
      const searchQuery: QueryConfig = {
        text: `SELECT b.book_id, b.title, b.author, b.publisher, ubl.score
               FROM books b INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
               WHERE title ILIKE $1
                  OR author ILIKE $1
                  OR publisher ILIKE $1
               LIMIT 100;`,
        values: [`%${queryString}%`],
      };

      const { rows } = await query(searchQuery);
      rows.forEach((row) => {
        if (!resultArray.some((item) => item.book_id === row.book_id)) {
          resultArray.push(row);
        }
      });
    }

    res.status(200).json(success(resultArray));
  } catch (error) {
    next(new ErrorWithStatus(500, 'book_list_error', 'Search failed'));
  }
};

export {
  getBookById,
  getFullList,
  fetchListByStatus,
  addBookToList,
  updateBook,
  deleteBook,
  searchBook,
};
