import { NextFunction, Request } from 'express';
import { Logger } from '../util/logger';
import {
  ftsSearch,
  getAllBooks,
  getBookById,
  getBooksByStatus,
  likeSearch,
  postBook,
  postBookToUserList,
} from '../db/books';
import { success } from '../util/response';
import { db } from '../db/config';
import { ErrorWithStatus } from '../util/errorhandler';
import { fetchFinnaImages } from './third-party/finna';
import { fetchOpenLibraryImages } from './third-party/openlibrary';
import { TypedRequest, TypedResponse } from '../util/zod';
import {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchSchema,
  updateOneSchema,
} from '../routes/books';
import { bookSortSchema, bookNumberKeySchema, bookStringKeySchema, DbBook } from '../db/model/book';
import { itemSorter, getItemFilter } from '../util/sort';
import { addAudit } from '../db/audit';
import { fillBookStatuses, StatusCountRow } from '../util/status';

export const fetchOne = async (
  req: TypedRequest<typeof fetchOneSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { bookId } = req.params;
  const username = res.locals.username;

  try {
    const book = await db.task('fetchOne', async (t) => await getBookById(t, { bookId, username }));
    res.status(200).json(success([book]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find book"));
  }
};

export const fetchAll = async (req: Request, res: TypedResponse, next: NextFunction) => {
  const username = res.locals.username;

  try {
    let books = await db.task('fetchAll', async (t) => await getAllBooks(t, username));

    const queryParams = bookSortSchema.safeParse(req.query);
    if (queryParams.success) {
      const { sort, order, filter } = queryParams.data;

      if (filter) {
        const itemFilter = getItemFilter({
          key: filter[0],
          stringSchema: bookStringKeySchema,
          numberSchema: bookNumberKeySchema,
        });
        if (itemFilter) {
          books = books.filter((book) =>
            itemFilter(book as unknown as Record<string, never>, filter),
          );
        }
      }

      books = books.toSorted((a, b) => itemSorter({ a, b, sort, order }));
    }

    res.status(200).json(success(books));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find books"));
  }
};

export const fetchByStatus = async (
  req: TypedRequest<typeof fetchByStatusSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const status = req.params.status;

  try {
    let books = await db.task(async (t) => await getBooksByStatus(t, { username, status }));

    const queryParams = bookSortSchema.safeParse(req.query);
    if (queryParams.success) {
      const { sort, order, filter } = queryParams.data;

      if (filter) {
        const itemFilter = getItemFilter({
          key: filter[0],
          stringSchema: bookStringKeySchema,
          numberSchema: bookNumberKeySchema,
        });
        if (itemFilter) {
          books = books.filter((book) =>
            itemFilter(book as unknown as Record<string, never>, filter),
          );
        }
      }

      books = books.toSorted((a, b) => itemSorter({ a, b, sort, order }));
    }

    res.status(200).json(success(books));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't find books"));
  }
};

export const addOne = async (
  req: TypedRequest<typeof addOneSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const book = req.body;

  try {
    await db.tx('addOne', async (t) => {
      const bookId = await postBook(t, book, username);
      await postBookToUserList(t, bookId, book, username);
      await addAudit(t, {
        username,
        action: 'create',
        table_name: 'books',
        record_id: bookId,
        new_data: book,
      });
    });

    res.status(201).json(success([{ name: 'book_added_to_list', message: 'Book added to list' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't add book"));
  }
};

export const updateOne = async (
  req: TypedRequest<typeof updateOneSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const { bookId } = req.params;
  const {
    isbn,
    title,
    author,
    publisher,
    image_url,
    pages,
    year,
    status,
    score,
    note,
    start_date,
    end_date,
  } = req.body;

  try {
    const { updatedBook } = await db.tx('updateOne', async (t) => {
      const oldBook = await getBookById(t, { bookId, username });
      await t.none({
        text: `UPDATE books
           SET title=$1,
               author=$2,
               publisher=$3,
               image_url=$4,
               pages=$5,
               isbn=$6,
               year=$7
           WHERE book_id = $8
             AND submitter = $9`,
        values: [title, author, publisher, image_url, pages, isbn, year, bookId, username],
      });
      await t.none({
        text: `UPDATE user_book_list
           SET status=$1,
               score=$2,
               note=$3,
               start_date=$4,
               end_date=$5
           WHERE book_id = $6`,
        values: [status, score, note, start_date, end_date, bookId],
      });
      const updatedBook = await getBookById(t, { bookId, username });
      await addAudit(t, {
        username,
        action: 'update',
        table_name: 'books',
        record_id: bookId,
        old_data: oldBook,
        new_data: updatedBook,
      });
      return { updatedBook };
    });

    res.status(200).json(success([updatedBook]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'book_list_error', "Couldn't update book"));
  }
};

export const deleteOne = async (
  req: TypedRequest<typeof deleteOneSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { bookId } = req.params;
  const username = res.locals.username;

  try {
    await db.tx('deleteOne', async (t) => {
      const book = await getBookById(t, { bookId, username });
      await t.none({
        text: `DELETE
           FROM books
           WHERE book_id = $1
             AND submitter = $2`,
        values: [bookId, username],
      });
      await addAudit(t, {
        username,
        action: 'delete',
        table_name: 'books',
        record_id: bookId,
        old_data: book,
      });
    });

    res.status(200).json(success([{ name: 'book_deleted', message: 'Book deleted' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'book_list_error', "Couldn't delete book"));
  }
};

export const search = async (
  req: TypedRequest<typeof searchSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  try {
    const queryString = String(req.query.query).trim();
    const queryAsArray = queryString.split(' ');
    const username = res.locals.username;

    const { results } = await db.task('search', async (t) => {
      const results: DbBook[] = [];

      for (const queryPart of queryAsArray) {
        const rows = await ftsSearch(t, { username, query: queryPart });
        // Push only unique results
        for (const row of rows) {
          if (!results.some((item) => item.book_id === row.book_id)) {
            results.push(row);
          }
        }
      }

      if (results.length === 0) {
        const rows = await likeSearch(t, { username, query: queryString });
        // Push only unique results
        for (const row of rows) {
          if (!results.some((item) => item.book_id === row.book_id)) {
            results.push(row);
          }
        }
      }

      return { results };
    });

    res.status(200).json(success(results));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'book_list_error', 'Search failed'));
  }
};

export const fetchImages = async (
  req: TypedRequest<typeof fetchImagesSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const query = req.query.query;

  try {
    const responses = await Promise.allSettled([
      fetchFinnaImages(query, 'book'),
      fetchOpenLibraryImages(query),
    ]);

    const images: string[] = responses
      .filter((response) => response.status === 'fulfilled')
      .flatMap((response) => response.value);

    res.status(200).json(success(images));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'book_list_error', 'Failed to fetch images'));
  }
};

export const countByStatus = async (req: Request, res: TypedResponse, next: NextFunction) => {
  const username = res.locals.username;

  try {
    const rows = await db.any<StatusCountRow>(
      `SELECT status, COUNT(*) AS count
        FROM user_book_list
        WHERE username = $1
        GROUP BY status`,
      [username],
    );

    const total = rows.reduce((acc, curr) => acc + curr.count, 0);
    const statuses = [...fillBookStatuses(rows), { status: 'all', count: total }];
    const result = Object.fromEntries(statuses.map(({ status, count }) => [status, count]));

    res.status(200).json(result);
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'book_list_error', "Couldn't count books"));
  }
};
