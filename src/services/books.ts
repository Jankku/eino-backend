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
  updateBook,
} from '../db/books';
import { success } from '../util/response';
import { db } from '../db/config';
import { config } from '../config';
import { getItemCountByUsernameForUpdate } from '../db/users';
import { ErrorWithStatus } from '../util/errorhandler';
import { fetchFinnaImages } from './third-party/finna';
import { fetchOpenLibraryEditionsByIsbn, fetchOpenLibraryImages } from './third-party/openlibrary';
import { TypedResponse } from '../util/zod';
import {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchIsbnSchema,
  searchSchema,
  updateOneSchema,
} from '../routes/books';
import {
  bookSortSchema,
  bookNumberKeySchema,
  bookStringKeySchema,
  bookDateKeySchema,
  DbBook,
} from '../db/model/book';
import { itemSorter, getItemFilter } from '../util/sort';
import { addAudit } from '../db/audit';
import { fillBookStatuses, StatusCountRow } from '../util/status';
import { fetchGoogleBooksByIsbn } from './third-party/googlebooks';
import { firstNonEmpty } from '../util/promise';

export const fetchOne = async (
  _: Request,
  res: TypedResponse<typeof fetchOneSchema>,
  next: NextFunction,
) => {
  const { bookId } = res.locals.input.params;
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
          dateSchema: bookDateKeySchema,
        });
        if (itemFilter) {
          books = books.filter((book) => itemFilter(book, filter));
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
  _: Request,
  res: TypedResponse<typeof fetchByStatusSchema>,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const status = res.locals.input.params.status;

  try {
    let books = await db.task(async (t) => await getBooksByStatus(t, { username, status }));

    const queryParams = res.locals.input.query;
    if (queryParams) {
      const { sort, order, filter } = queryParams;

      if (filter) {
        const itemFilter = getItemFilter({
          key: filter[0],
          stringSchema: bookStringKeySchema,
          numberSchema: bookNumberKeySchema,
          dateSchema: bookDateKeySchema,
        });
        if (itemFilter) {
          books = books.filter((book) => itemFilter(book, filter));
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
  _: Request,
  res: TypedResponse<typeof addOneSchema>,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const book = res.locals.input.body;

  try {
    await db.tx('addOne', async (t) => {
      const { book_count } = await getItemCountByUsernameForUpdate(t, username);
      const maxItemCount = config.USER_LIST_ITEM_MAX_COUNT;
      if (book_count + 1 > maxItemCount) {
        throw new ErrorWithStatus(422, 'book_list_error', 'Item count exceeds the maximum count');
      }

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
    if (error instanceof ErrorWithStatus) {
      next(error);
      return;
    }
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'book_list_error', "Couldn't add book"));
  }
};

export const updateOne = async (
  _: Request,
  res: TypedResponse<typeof updateOneSchema>,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const { bookId } = res.locals.input.params;
  const book = res.locals.input.body;

  try {
    const { updatedBook } = await db.tx('updateOne', async (t) => {
      const oldBook = await getBookById(t, { bookId, username });
      await updateBook(t, { book, bookId, username });
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
  _: Request,
  res: TypedResponse<typeof deleteOneSchema>,
  next: NextFunction,
) => {
  const { bookId } = res.locals.input.params;
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
  _: Request,
  res: TypedResponse<typeof searchSchema>,
  next: NextFunction,
) => {
  try {
    const queryString = res.locals.input.query.query.trim();
    if (!queryString) {
      res.status(200).json(success([]));
      return;
    }
    const queryAsArray = queryString.split(/\s+/);
    const username = res.locals.username;

    const { results } = await db.task('search', async (t) => {
      const results: DbBook[] = [];

      for (const queryPart of queryAsArray) {
        const rows = await ftsSearch(t, { username, query: queryPart });
        // Push only unique results
        for (const row of rows) {
          if (results.every((item) => item.book_id !== row.book_id)) {
            results.push(row);
          }
        }
      }

      if (results.length === 0) {
        const rows = await likeSearch(t, { username, query: queryString });
        // Push only unique results
        for (const row of rows) {
          if (results.every((item) => item.book_id !== row.book_id)) {
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

export const searchIsbn = async (
  _: Request,
  res: TypedResponse<typeof searchIsbnSchema>,
  next: NextFunction,
) => {
  const { isbn } = res.locals.input.params;

  try {
    const books = await firstNonEmpty([
      () => fetchGoogleBooksByIsbn(isbn),
      () => fetchOpenLibraryEditionsByIsbn(isbn),
    ]);
    res.status(200).json(success(books));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'isbn_search_error', "Couldn't find book with this ISBN"));
  }
};

export const fetchImages = async (
  _: Request,
  res: TypedResponse<typeof fetchImagesSchema>,
  next: NextFunction,
) => {
  const query = res.locals.input.query.query;

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
