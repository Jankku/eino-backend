import { Request, Response } from 'express';
import Logger from '../util/logger';
import { postBook, getBooksByStatus } from '../db/books';
import { error, success } from '../util/response';
import Status from '../db/model/status';
import Book from '../db/model/book';
import { pool, query } from '../db/config';

const getBook = async (req: Request, res: Response) => {
  const { bookId } = req.params;
  const submitter = res.locals.username;

  const getBookQuery = {
    text: 'SELECT * FROM books WHERE book_id=$1 AND submitter=$2 LIMIT 1',
    values: [bookId, submitter],
  };

  try {
    const result = await query(getBookQuery);
    res.status(200).json(success(result.rows));
  } catch (err) {
    Logger.error(err.stack);
    res.status(422).json(error([{ code: 'book_list_error', message: 'Couldnt find book' }]));
  }
};

const fetchList = async (req: Request, res: Response, status: Status) => {
  const { username } = res.locals;

  try {
    const books = await getBooksByStatus(username, status);
    res.status(200).json(success(books));
  } catch (err) {
    Logger.error(err.stack);
    res.status(422).json(error([{ code: 'book_list_error', message: 'Couldnt find books' }]));
  }
};

const getCompletedList = (req: Request, res: Response) => fetchList(req, res, 'completed');
const getReadingList = (req: Request, res: Response) => fetchList(req, res, 'reading');
const getOnHoldList = (req: Request, res: Response) => fetchList(req, res, 'on-hold');
const getDroppedList = (req: Request, res: Response) => fetchList(req, res, 'dropped');
const getPlannedList = (req: Request, res: Response) => fetchList(req, res, 'planned');

const addBookToList = async (req: Request, res: Response) => {
  const client = await pool.connect();
  const {
    isbn, title, author, publisher, pages, status, score,
  } = req.body;
  const { username } = res.locals;
  const book: Book = {
    title,
    author,
    publisher,
    isbn,
    pages,
    submitter: username,
  };

  try {
    await client.query('BEGIN');
    try {
      // Insert book to books table
      await postBook(book)
        .then((bookId) => {
          const addBookToUserListQuery = {
            text: 'INSERT INTO user_book_list (book_id, username, status, score) VALUES ($1, $2, $3, $4)',
            values: [bookId, username, status, score],
          };

          // Insert book to user list
          query(addBookToUserListQuery);
          res.status(201).json(success({ code: 'book_added_to_list', message: 'Book added to list' }));
        });
      await client.query('END');
    } catch (err) {
      await client.query('ROLLBACK');

      Logger.error(err.stack);
      res.status(500).json(error([{ code: 'book_list_error', message: 'Couldnt update list' }]));
    }
  } finally {
    client.release();
  }
};

const updateBook = async (req: Request, res: Response) => {
  const {
    isbn, title, author, publisher, pages,
  } = req.body;
  const { bookId } = req.params;
  const submitter = res.locals.username;

  const updateBookQuery = {
    text: 'UPDATE books SET title=$1, author=$2, publisher=$3, pages=$4, isbn=$5 WHERE book_id=$6 AND submitter=$7 RETURNING *',
    values: [title, author, publisher, pages, isbn, bookId, submitter],
  };

  try {
    const result = await query(updateBookQuery);
    res.status(200).json(success(result.rows));
  } catch (err) {
    Logger.error(err.stack);
    res.status(422).json(error([{ code: 'book_list_error', message: 'Couldnt update book' }]));
  }
};

const deleteBook = async (req: Request, res: Response) => {
  const { bookId } = req.params;
  const submitter = res.locals.username;

  const deleteBookQuery = {
    text: 'DELETE FROM books WHERE book_id=$1 AND submitter=$2',
    values: [bookId, submitter],
  };

  try {
    await query(deleteBookQuery);
    res.status(200).json(success({ code: 'book_deleted', message: 'Book deleted' }));
  } catch (err) {
    Logger.error(err.stack);
    res.status(422).json(error([{ code: 'book_list_error', message: 'Couldnt delete book' }]));
  }
};

export {
  getBook,
  getCompletedList,
  getReadingList,
  getOnHoldList,
  getDroppedList,
  getPlannedList,
  addBookToList,
  updateBook,
  deleteBook,
};
