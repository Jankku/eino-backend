import express from 'express';
import { validateSchema } from '../../middleware/validateschema';
import { validatePagination } from '../../middleware/pagination';
import { movieSortSchema } from '../../db/model/movie';
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

const createMovieRouter = (paginated: boolean) => {
  const movieRouter = express.Router();
  const pagination = paginated ? [validatePagination(movieSortSchema), movies.fetchPage] : [];

  movieRouter.get('/count', movies.countByStatus);
  movieRouter.get('/search', validateSchema(searchSchema), movies.search);
  movieRouter.get('/movie/:movieId', validateSchema(fetchOneSchema), movies.fetchOne);
  movieRouter.post('/add', validateSchema(addOneSchema), movies.addOne);
  movieRouter.put('/update/:movieId', validateSchema(updateOneSchema), movies.updateOne);
  movieRouter.delete('/delete/:movieId', validateSchema(deleteOneSchema), movies.deleteOne);
  movieRouter.get('/images', validateSchema(fetchImagesSchema), movies.fetchImages);

  movieRouter.get('/all', ...pagination, movies.fetchAll);
  movieRouter.get(
    '/:status',
    validateSchema(fetchByStatusSchema),
    ...pagination,
    movies.fetchByStatus,
  );
  return movieRouter;
};

export const movieRouter = createMovieRouter(false);
export const movieRouterV2 = createMovieRouter(true);
