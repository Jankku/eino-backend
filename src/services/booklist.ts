import { NextFunction, Request, Response } from 'express';
import Logger from '../util/logger';
import { postBook, getBooksByStatus } from '../db/books';
import { success } from '../util/response';
import BookStatus from '../db/model/bookstatus';
import Book from '../db/model/book';
import { pool, query } from '../db/config';
import { ErrorHandler } from '../util/errorhandler';

const getBookById = async (req: Request, res: Response, next: NextFunction) => {
  const { bookId } = req.params;
  const submitter = res.locals.username;

  const getBookQuery = {
    text: 'SELECT ubl.book_id, b.isbn, b.title, b.author, b.publisher, b.pages, b.year, ubl.status, ubl.score, ubl.created_on FROM user_book_list ubl, books b WHERE ubl.book_id=b.book_id AND ubl.book_id=$1 AND b.submitter=$2',
    values: [bookId, submitter],
  };

  try {
    const result = await query(getBookQuery);
    res.status(200).json(success(result.rows));
  } catch (err) {
    next(new ErrorHandler(422, 'book_list_error', 'Couldnt find book'));
  }
};

const fetchList = async (req: Request, res: Response, status: BookStatus, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const books = await getBooksByStatus(username, status);
    res.status(200).json(success(books));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'book_list_error', 'Couldnt find book'));
  }
};

const getCompletedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'completed', next);
const getReadingList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'reading', next);
const getOnHoldList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'on-hold', next);
const getDroppedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'dropped', next);
const getPlannedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'planned', next);

const addBookToList = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  const {
    isbn, title, author, publisher, pages, year, status, score, start_date, end_date,
  } = req.body;
  const { username } = res.locals;
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
    await client.query('BEGIN');
    try {
      // Insert book to books table
      await postBook(book).then((bookId) => {
        // Insert book to user's booklist
        const addBookToUserListQuery = {
          text: 'INSERT INTO user_book_list (book_id, username, status, score, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6)',
          values: [bookId, username, status, score, start_date, end_date],
        };
        query(addBookToUserListQuery);
        res.status(201).json(success({ name: 'book_added_to_list', message: 'Book added to list' }));
      });
      await client.query('END');
    } catch (err) {
      await client.query('ROLLBACK');

      Logger.error(err.stack);
      next(new ErrorHandler(422, 'book_list_error', 'Couldnt update list'));
    }
  } finally {
    client.release();
  }
};

const updateBook = async (req: Request, res: Response, next: NextFunction) => {
  const {
    isbn, title, author, publisher, pages, year,
  } = req.body;
  const { bookId } = req.params;
  const submitter = res.locals.username;

  const updateBookQuery = {
    text: 'UPDATE books SET title=$1, author=$2, publisher=$3, pages=$4, isbn=$5, year=$6 WHERE book_id=$7 AND submitter=$8 RETURNING book_id, title, author, publisher, pages, isbn, year',
    values: [title, author, publisher, pages, isbn, year, bookId, submitter],
  };

  try {
    const result = await query(updateBookQuery);
    res.status(200).json(success(result.rows));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'book_list_error', 'Couldnt update book'));
  }
};

const deleteBook = async (req: Request, res: Response, next: NextFunction) => {
  const { bookId } = req.params;
  const submitter = res.locals.username;

  const deleteBookQuery = {
    text: 'DELETE FROM books WHERE book_id=$1 AND submitter=$2',
    values: [bookId, submitter],
  };

  try {
    await query(deleteBookQuery);
    res.status(200).json(success({ name: 'book_deleted', message: 'Book deleted' }));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'book_list_error', 'Couldnt delete book'));
  }
};

export {
  getBookById,
  getCompletedList,
  getReadingList,
  getOnHoldList,
  getDroppedList,
  getPlannedList,
  addBookToList,
  updateBook,
  deleteBook,
};
