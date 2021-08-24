import { NextFunction, Request, Response } from 'express';
import Logger from '../util/logger';
import { postBook, getBooksByStatus, getAllBooks } from '../db/books';
import { success } from '../util/response';
import BookStatus from '../db/model/bookstatus';
import Book from '../db/model/book';
import { query } from '../db/config';
import { ErrorHandler } from '../util/errorhandler';

const getBookById = async (req: Request, res: Response, next: NextFunction) => {
  const { bookId } = req.params;
  const { username } = res.locals;

  const getBookQuery = {
    text: 'SELECT b.book_id, b.isbn, b.title, b.author, b.publisher, b.pages, b.year, ubl.status, ubl.score, ubl.start_date, ubl.end_date, ubl.created_on FROM user_book_list ubl, books b WHERE ubl.book_id=b.book_id AND ubl.book_id=$1 AND b.submitter=$2',
    values: [bookId, username],
  };

  try {
    const result = await query(getBookQuery);

    if (result.rowCount === 0) {
      next(new ErrorHandler(422, 'book_list_error', 'Couldn\'t find book'));
      return;
    }

    res.status(200).json(success(result.rows));
  } catch (err) {
    next(new ErrorHandler(422, 'book_list_error', 'Couldn\'t find book'));
  }
};

const fetchAllBooks = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const books = await getAllBooks(username);
    res.status(200).json(success(books));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'book_list_error', 'Couldn\'t find books'));
  }
};

const fetchList = async (req: Request, res: Response, status: BookStatus, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const books = await getBooksByStatus(username, status);
    res.status(200).json(success(books));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'book_list_error', 'Couldn\'t find books'));
  }
};

const getFullBookList = (req: Request, res: Response, next: NextFunction) => fetchAllBooks(req, res, next);
const getCompletedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'completed', next);
const getReadingList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'reading', next);
const getOnHoldList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'on-hold', next);
const getDroppedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'dropped', next);
const getPlannedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'planned', next);

const addBookToList = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const {
    isbn, title, author, publisher, pages, year, status, score, start_date, end_date,
  } = req.body;
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
    await postBook(book).then((bookId) => {
    // Insert book to user's booklist
      const addBookToUserListQuery = {
        text: 'INSERT INTO user_book_list (book_id, username, status, score, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6)',
        values: [bookId, username, status, score, start_date, end_date],
      };
      query(addBookToUserListQuery);
      res.status(201).json(success([{ name: 'book_added_to_list', message: 'Book added to list' }]));
    });
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'book_list_error', 'Couldn\'t update list'));
  }
};

const updateBook = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const { bookId } = req.params;
  const {
    isbn, title, author, publisher, pages, year, status, score, start_date, end_date,
  } = req.body;

  const updateBookQuery = {
    text: 'UPDATE books SET title=$1, author=$2, publisher=$3, pages=$4, isbn=$5, year=$6 WHERE book_id=$7 AND submitter=$8 RETURNING book_id, title, author, publisher, pages, isbn, year',
    values: [title, author, publisher, pages, isbn, year, bookId, username],
  };

  const updateUserListQuery = {
    text: 'UPDATE user_book_list SET status=$1, score=$2, start_date=$3, end_date=$4 WHERE book_id=$5',
    values: [status, score, start_date, end_date, bookId],
  };

  try {
    await query(updateBookQuery);
    await query(updateUserListQuery);
    res.status(200).json(success([{ name: 'book_updated', message: 'Book successfully updated' }]));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'book_list_error', 'Couldn\'t update book'));
  }
};

const deleteBook = async (req: Request, res: Response, next: NextFunction) => {
  const { bookId } = req.params;
  const { username } = res.locals;

  const deleteBookQuery = {
    text: 'DELETE FROM books WHERE book_id=$1 AND submitter=$2',
    values: [bookId, username],
  };

  try {
    await query(deleteBookQuery);
    res.status(200).json(success([{ name: 'book_deleted', message: 'Book deleted' }]));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'book_list_error', 'Couldn\'t delete book'));
  }
};

export {
  getBookById,
  getFullBookList,
  getCompletedList,
  getReadingList,
  getOnHoldList,
  getDroppedList,
  getPlannedList,
  addBookToList,
  updateBook,
  deleteBook,
};
