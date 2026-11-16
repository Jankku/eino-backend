import express from 'express';
import { validateSchema } from '../../middleware/validateschema.ts';
import { validatePagination } from '../../middleware/pagination.ts';
import { movieSortSchema } from '../../db/model/movie.ts';
import * as movies from '../../services/movies.ts';
import {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchSchema,
  updateOneSchema,
} from './schema.ts';

export const movieRouterV2 = express.Router();
const pagination = [validatePagination(movieSortSchema), movies.fetchPage];

movieRouterV2.get('/count', movies.countByStatus);
movieRouterV2.get('/search', validateSchema(searchSchema), movies.search);
movieRouterV2.get('/movie/:movieId', validateSchema(fetchOneSchema), movies.fetchOne);
movieRouterV2.post('/add', validateSchema(addOneSchema), movies.addOne);
movieRouterV2.put('/update/:movieId', validateSchema(updateOneSchema), movies.updateOne);
movieRouterV2.delete('/delete/:movieId', validateSchema(deleteOneSchema), movies.deleteOne);
movieRouterV2.get('/images', validateSchema(fetchImagesSchema), movies.fetchImages);

movieRouterV2.get('/all', ...pagination, movies.fetchAll);
movieRouterV2.get(
  '/:status',
  validateSchema(fetchByStatusSchema),
  ...pagination,
  movies.fetchByStatus,
);
