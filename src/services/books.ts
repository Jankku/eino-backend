import type { NextFunction, Request } from 'express';
import {
  ftsSearch,
  getAllBooks,
  getBookById,
  getBooksByStatus,
  getBooksPage,
  likeSearch,
  postBook,
  postBookToUserList,
  updateBook,
} from '../db/books.ts';
import { success } from '../util/response.ts';
import { db } from '../db/config.ts';
import { config } from '../config.ts';
import { getItemCountByUserIdForUpdate } from '../db/users.ts';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { fetchFinnaImages } from './third-party/finna.ts';
import {
  fetchOpenLibraryEditionsByIsbn,
  fetchOpenLibraryImages,
} from './third-party/openlibrary.ts';
import type { TypedResponse } from '../util/zod.ts';
import type {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchIsbnSchema,
  searchSchema,
  updateOneSchema,
} from '../routes/books/index.ts';
import {
  bookSortSchema,
  bookNumberKeySchema,
  bookStringKeySchema,
  bookDateKeySchema,
} from '../db/model/book.ts';
import { itemSorter, getItemFilter } from '../util/sort.ts';
import { addAudit } from '../db/audit.ts';
import { fillBookStatuses, type StatusCountRow } from '../util/status.ts';
import { fetchGoogleBooksByIsbn } from './third-party/googlebooks.ts';
import { firstNonEmpty } from '../util/promise.ts';
import { paginationMode } from '../db/pagination.ts';

export const fetchPage = async (
  req: Request,
  res: TypedResponse<typeof fetchByStatusSchema>,
  next: NextFunction,
) => {
  const { pagination, listQuery, userId } = res.locals;
  if (!pagination || !listQuery) {
    next();
    return;
  }
  const page = await db.tx({ mode: paginationMode }, (t) =>
    getBooksPage(t, {
      userId,
      pagination,
      listQuery,
      status: req.params.status ? res.locals.input.params.status : undefined,
    }),
  );
  res.status(200).json(page);
};

export const fetchOne = async (_: Request, res: TypedResponse<typeof fetchOneSchema>) => {
  const { bookId } = res.locals.input.params;
  const userId = res.locals.userId;

  const book = await db.task('fetchOne', async (t) => await getBookById(t, { bookId, userId }));
  res.status(200).json(success([book]));
};

export const fetchAll = async (req: Request, res: TypedResponse) => {
  const userId = res.locals.userId;

  let books = await db.task('fetchAll', async (t) => await getAllBooks(t, userId));

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
};

export const fetchByStatus = async (_: Request, res: TypedResponse<typeof fetchByStatusSchema>) => {
  const userId = res.locals.userId;
  const status = res.locals.input.params.status;

  let books = await db.task(async (t) => await getBooksByStatus(t, { userId, status }));

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
};

export const addOne = async (_: Request, res: TypedResponse<typeof addOneSchema>) => {
  const { userId, username } = res.locals;
  const book = res.locals.input.body;

  await db.tx('addOne', async (t) => {
    const { book_count } = await getItemCountByUserIdForUpdate(t, userId);
    const maxItemCount = config.USER_LIST_ITEM_MAX_COUNT;
    if (book_count + 1 > maxItemCount) {
      throw new ErrorWithStatus(422, 'book_list_error', 'Item count exceeds the maximum count');
    }

    const bookId = await postBook(t, book, userId);
    await postBookToUserList(t, bookId, book);
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username,
      action: 'create',
      table_name: 'books',
      record_id: bookId,
      new_data: book,
    });
  });

  res.status(201).json(success([{ name: 'book_added_to_list', message: 'Book added to list' }]));
};

export const updateOne = async (_: Request, res: TypedResponse<typeof updateOneSchema>) => {
  const { userId, username } = res.locals;
  const { bookId } = res.locals.input.params;
  const book = res.locals.input.body;

  const updatedBook = await db.tx('updateOne', async (t) => {
    const oldBook = await getBookById(t, { bookId, userId });
    await updateBook(t, { book, bookId, userId });
    const updatedBook = await getBookById(t, { bookId, userId });
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username,
      action: 'update',
      table_name: 'books',
      record_id: bookId,
      old_data: oldBook,
      new_data: updatedBook,
    });
    return updatedBook;
  });

  res.status(200).json(success([updatedBook]));
};

export const deleteOne = async (_: Request, res: TypedResponse<typeof deleteOneSchema>) => {
  const { bookId } = res.locals.input.params;
  const { userId, username } = res.locals;

  await db.tx('deleteOne', async (t) => {
    const book = await getBookById(t, { bookId, userId });
    await t.none({
      text: `DELETE
         FROM books
         WHERE book_id = $1
           AND user_id = $2`,
      values: [bookId, userId],
    });
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username,
      action: 'delete',
      table_name: 'books',
      record_id: bookId,
      old_data: book,
    });
  });

  res.status(200).json(success([{ name: 'book_deleted', message: 'Book deleted' }]));
};

export const search = async (_: Request, res: TypedResponse<typeof searchSchema>) => {
  const queryString = res.locals.input.query.query.trim();
  if (!queryString) {
    res.status(200).json(success([]));
    return;
  }
  const userId = res.locals.userId;

  const results = await db.task('search', async (t) => {
    const matches = await ftsSearch(t, { userId, query: queryString });
    return matches.length > 0 ? matches : await likeSearch(t, { userId, query: queryString });
  });

  res.status(200).json(success(results));
};

export const searchIsbn = async (_: Request, res: TypedResponse<typeof searchIsbnSchema>) => {
  const { isbn } = res.locals.input.params;

  const books = await firstNonEmpty([
    () => fetchGoogleBooksByIsbn(isbn),
    () => fetchOpenLibraryEditionsByIsbn(isbn),
  ]);
  res.status(200).json(success(books));
};

export const fetchImages = async (_: Request, res: TypedResponse<typeof fetchImagesSchema>) => {
  const query = res.locals.input.query.query;

  const responses = await Promise.allSettled([
    fetchFinnaImages(query, 'book'),
    fetchOpenLibraryImages(query),
  ]);

  const images: string[] = responses
    .filter((response) => response.status === 'fulfilled')
    .flatMap((response) => response.value);

  res.status(200).json(success(images));
};

export const countByStatus = async (_req: Request, res: TypedResponse) => {
  const userId = res.locals.userId;

  const rows = await db.any<StatusCountRow>(
    `SELECT ubl.status, COUNT(*) AS count
      FROM user_book_list ubl
      INNER JOIN books b USING (book_id)
      WHERE b.user_id = $1
      GROUP BY ubl.status`,
    [userId],
  );

  const total = rows.reduce((acc, curr) => acc + curr.count, 0);
  const statuses = [...fillBookStatuses(rows), { status: 'all', count: total }];
  const result = Object.fromEntries(statuses.map(({ status, count }) => [status, count]));

  res.status(200).json(result);
};
