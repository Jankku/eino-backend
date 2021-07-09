import { Request, Response } from 'express';
import Logger from '../util/logger';
import { postBook, getBooksByStatus } from '../db/books';
import { error, success } from '../util/response';
import Status from '../db/model/status';
import Book from '../db/model/book';
import { pool, query } from '../db/config';

const fetchList = async (req: Request, res: Response, status: Status) => {
  try {
    const { username } = res.locals;
    const books = await getBooksByStatus(username, status);
    res.status(200).json(success(books));
  } catch (err) {
    Logger.error(err);
    res.send(422).json(error([{ code: 'book_list_error', message: 'Couldnt find books' }]));
  }
};

const addBookToList = async (req: Request, res: Response) => {
  const { username } = res.locals;

  const {
    isbn, title, author, publisher, pages, status, score,
  } = req.body;

  const book: Book = {
    title,
    author,
    publisher,
    isbn,
    pages,
    submitter: username,
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    try {
      const bookId: string = await postBook(book);

      const addBookToUserListQuery = {
        text: 'INSERT INTO user_book_list (book_id, username, status, score) VALUES ($1, $2, $3, $4)',
        values: [bookId, username, status, score],
      };

      query(addBookToUserListQuery)
        .then(() => {
          res.status(201).json(success({ code: 'book_added_to_list', message: 'Book added to list' }));
        });

      await client.query('END');
    } catch (err) {
      await client.query('ROLLBACK');
      Logger.error(err);
      res.status(500).json(error([{ code: 'book_list_error', message: 'Couldnt update list' }]));
    }
  } finally {
    client.release();
  }
};

const getCompletedList = (req: Request, res: Response) => fetchList(req, res, 'completed');
const getReadingList = (req: Request, res: Response) => fetchList(req, res, 'reading');
const getOnHoldList = (req: Request, res: Response) => fetchList(req, res, 'on-hold');
const getDroppedList = (req: Request, res: Response) => fetchList(req, res, 'dropped');
const getPlannedList = (req: Request, res: Response) => fetchList(req, res, 'planned');

export {
  getCompletedList,
  getReadingList,
  getOnHoldList,
  getDroppedList,
  getPlannedList,
  addBookToList,
};
