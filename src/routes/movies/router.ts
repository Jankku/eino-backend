import express from 'express';
import { validateSchema } from '../../middleware/validateschema';
import * as movies from '../../services/movies';
import {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchSchema,
  updateOneSchema,
} from './schema';

export const movieRouter = express.Router();

movieRouter.get('/count', movies.countByStatus);
movieRouter.get('/search', validateSchema(searchSchema), movies.search);
movieRouter.get('/movie/:movieId', validateSchema(fetchOneSchema), movies.fetchOne);
movieRouter.post('/add', validateSchema(addOneSchema), movies.addOne);
movieRouter.put('/update/:movieId', validateSchema(updateOneSchema), movies.updateOne);
movieRouter.delete('/delete/:movieId', validateSchema(deleteOneSchema), movies.deleteOne);
movieRouter.get('/images', validateSchema(fetchImagesSchema), movies.fetchImages);

movieRouter.get('/all', movies.fetchAll);
movieRouter.get('/:status', validateSchema(fetchByStatusSchema), movies.fetchByStatus);
