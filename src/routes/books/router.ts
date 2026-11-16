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

export const bookRouterV2 = express.Router();
const pagination = [validatePagination(bookSortSchema), books.fetchPage];

bookRouterV2.get('/count', books.countByStatus);
bookRouterV2.get('/search', validateSchema(searchSchema), books.search);
bookRouterV2.get('/search/isbn/:isbn', validateSchema(searchIsbnSchema), books.searchIsbn);
bookRouterV2.get('/book/:bookId', validateSchema(fetchOneSchema), books.fetchOne);
bookRouterV2.post('/add', validateSchema(addOneSchema), books.addOne);
bookRouterV2.put('/update/:bookId', validateSchema(updateOneSchema), books.updateOne);
bookRouterV2.delete('/delete/:bookId', validateSchema(deleteOneSchema), books.deleteOne);
bookRouterV2.get('/images', validateSchema(fetchImagesSchema), books.fetchImages);

bookRouterV2.get('/all', ...pagination, books.fetchAll);
bookRouterV2.get(
  '/:status',
  validateSchema(fetchByStatusSchema),
  ...pagination,
  books.fetchByStatus,
);
