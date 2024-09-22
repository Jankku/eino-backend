import express from 'express';
import { validateSchema } from '../../middleware/validateschema';
import * as books from '../../services/books';
import {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchSchema,
  updateOneSchema,
} from './schema';

export const bookRouter = express.Router();

bookRouter.get('/search', validateSchema(searchSchema), books.search);
bookRouter.get('/book/:bookId', validateSchema(fetchOneSchema), books.fetchOne);
bookRouter.post('/add', validateSchema(addOneSchema), books.addOne);
bookRouter.put('/update/:bookId', validateSchema(updateOneSchema), books.updateOne);
bookRouter.delete('/delete/:bookId', validateSchema(deleteOneSchema), books.deleteOne);
bookRouter.get('/images', validateSchema(fetchImagesSchema), books.fetchImages);

bookRouter.get('/all', books.fetchAll);
bookRouter.get('/:status', validateSchema(fetchByStatusSchema), books.fetchByStatus);
