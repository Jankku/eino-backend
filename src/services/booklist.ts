import { NextFunction, Request, Response } from 'express';
import { QueryConfig } from 'pg';
import Logger from '../util/logger';
import { getAllBooks, getBookById, getBooksByStatus, postBook } from '../db/books';
import { success } from '../util/response';
import BookStatus from '../db/model/bookstatus';
import Book from '../db/model/book';
import { query, transaction } from '../db/config';
import { ErrorWithStatus } from '../util/errorhandler';
import BookSearchResult from '../db/model/booksearchresult';

const fetchOne = async (req: Request, res: Response, next: NextFunction) => {
  const { bookId } = req.params;
  const { username } = res.locals;

  try {
    const book = await getBookById(bookId, username);
    res.status(200).json(success(book));
  } catch (error) {
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find book"));
  }
};

const fetchAll = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const books = await getAllBooks(username);
    res.status(200).json(success(books));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find books"));
  }
};

const fetchByStatus = async (
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

const addOne = async (req: Request, res: Response, next: NextFunction) => {
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
    await transaction(async (client) => {
      const bookId = await postBook(client, book);
      const addBookToUserListQuery: QueryConfig = {
        text: `INSERT INTO user_book_list (book_id, username, status, score, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
        values: [bookId, username, status, score, start_date, end_date],
      };
      await client.query(addBookToUserListQuery);
    });

    res.status(201).json(success([{ name: 'book_added_to_list', message: 'Book added to list' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't addOne book"));
  }
};

const updateOne = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const { bookId } = req.params;
  const { isbn, title, author, publisher, pages, year, status, score, start_date, end_date } =
    req.body;

  const updateQuery: QueryConfig = {
    text: `UPDATE books
           SET title=$1,
               author=$2,
               publisher=$3,
               pages=$4,
               isbn=$5,
               year=$6
           WHERE book_id = $7
             AND submitter = $8`,
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
    await transaction(async (client) => {
      await client.query(updateQuery);
      await client.query(updateUserListQuery);
    });
    const updatedBook = await getBookById(bookId, username);
    res.status(200).json(success(updatedBook));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't updateOne book"));
  }
};

const deleteOne = async (req: Request, res: Response, next: NextFunction) => {
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
    await query(deleteBookQuery);
    res.status(200).json(success([{ name: 'book_deleted', message: 'Book deleted' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't delete book"));
  }
};

const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryString = String(req.query.query).trim();
    const queryAsArray = queryString.split(' ');
    const { username } = res.locals;
    const resultArray: BookSearchResult[] = [];

    for (const queryPart of queryAsArray) {
      const accurateSearchQuery: QueryConfig = {
        text: `SELECT b.book_id, b.title, b.author, b.publisher, ubl.score
               FROM books b INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
               WHERE document @@ to_tsquery('english', $2)
                 AND submitter = $1
               ORDER BY ts_rank(document, plainto_tsquery($2)) DESC;`,
        values: [username, `${queryPart}:*`],
      };

      const { rows } = await query(accurateSearchQuery);
      // Push only unique results
      rows.forEach((row) => {
        if (!resultArray.some((item) => item.book_id === row.book_id)) {
          resultArray.push(row);
        }
      });
    }

    if (resultArray.length === 0) {
      const lessAccurateSearchQuery: QueryConfig = {
        text: `SELECT b.book_id, b.title, b.author, b.publisher, ubl.score
               FROM books b INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
               WHERE title ILIKE $1
                  OR author ILIKE $1
                  OR publisher ILIKE $1
               LIMIT 100;`,
        values: [`%${queryString}%`],
      };

      const { rows } = await query(lessAccurateSearchQuery);
      // Push only unique results
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

export { fetchOne, fetchAll, fetchByStatus, addOne, updateOne, deleteOne, search };
