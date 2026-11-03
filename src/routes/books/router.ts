import express from 'express';
import { validateSchema } from '../../middleware/validateschema.ts';
import { validatePagination } from '../../middleware/pagination.ts';
import { bookSortSchema } from '../../db/model/book.ts';
import * as books from '../../services/books.ts';
import {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchSchema,
  updateOneSchema,
  searchIsbnSchema,
} from './schema.ts';

const createBookRouter = (paginated: boolean) => {
  const bookRouter = express.Router();
  const pagination = paginated ? [validatePagination(bookSortSchema), books.fetchPage] : [];

  bookRouter.get('/count', books.countByStatus);
  bookRouter.get('/search', validateSchema(searchSchema), books.search);
  bookRouter.get('/search/isbn/:isbn', validateSchema(searchIsbnSchema), books.searchIsbn);
  bookRouter.get('/book/:bookId', validateSchema(fetchOneSchema), books.fetchOne);
  bookRouter.post('/add', validateSchema(addOneSchema), books.addOne);
  bookRouter.put('/update/:bookId', validateSchema(updateOneSchema), books.updateOne);
  bookRouter.delete('/delete/:bookId', validateSchema(deleteOneSchema), books.deleteOne);
  bookRouter.get('/images', validateSchema(fetchImagesSchema), books.fetchImages);

  bookRouter.get('/all', ...pagination, books.fetchAll);
  bookRouter.get(
    '/:status',
    validateSchema(fetchByStatusSchema),
    ...pagination,
    books.fetchByStatus,
  );
  return bookRouter;
};

export const bookRouter = createBookRouter(false);
export const bookRouterV2 = createBookRouter(true);
