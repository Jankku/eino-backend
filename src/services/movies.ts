import type { NextFunction, Request } from 'express';
import {
  ftsSearch,
  getAllMovies,
  getMovieById,
  getMoviesByStatus,
  getMoviesPage,
  likeSearch,
  postMovie,
  postMovieToUserList,
  updateMovie,
} from '../db/movies.ts';
import { success } from '../util/response.ts';
import { db } from '../db/config.ts';
import { config } from '../config.ts';
import { getItemCountByUserIdForUpdate } from '../db/users.ts';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { fetchTmdbImages } from './third-party/tmdb.ts';
import { fetchFinnaImages } from './third-party/finna.ts';
import type {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchSchema,
  updateOneSchema,
} from '../routes/movies/index.ts';
import type { TypedResponse } from '../util/zod.ts';
import {
  movieNumberKeySchema,
  movieSortSchema,
  movieStringKeySchema,
  movieDateKeySchema,
} from '../db/model/movie.ts';
import { getItemFilter, itemSorter } from '../util/sort.ts';
import { addAudit } from '../db/audit.ts';
import { fillMovieStatuses, type StatusCountRow } from '../util/status.ts';
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
    getMoviesPage(t, {
      userId,
      pagination,
      listQuery,
      status: req.params.status ? res.locals.input.params.status : undefined,
    }),
  );
  res.status(200).json(page);
};

export const fetchOne = async (_: Request, res: TypedResponse<typeof fetchOneSchema>) => {
  const { movieId } = res.locals.input.params;
  const userId = res.locals.userId;

  const movie = await db.task('fetchOne', async (t) => await getMovieById(t, { movieId, userId }));
  res.status(200).json(success([movie]));
};

export const fetchAll = async (req: Request, res: TypedResponse) => {
  const userId = res.locals.userId;

  let movies = await db.task('fetchAll', async (t) => await getAllMovies(t, userId));

  const queryParams = movieSortSchema.safeParse(req.query);
  if (queryParams.success) {
    const { sort, order, filter } = queryParams.data;

    if (filter) {
      const itemFilter = getItemFilter({
        key: filter[0],
        stringSchema: movieStringKeySchema,
        numberSchema: movieNumberKeySchema,
        dateSchema: movieDateKeySchema,
      });
      if (itemFilter) {
        movies = movies.filter((movie) => itemFilter(movie, filter));
      }
    }

    movies = movies.toSorted((a, b) => itemSorter({ a, b, sort, order }));
  }

  res.status(200).json(success(movies));
};

export const fetchByStatus = async (_: Request, res: TypedResponse<typeof fetchByStatusSchema>) => {
  const userId = res.locals.userId;
  const status = res.locals.input.params.status;

  let movies = await db.task(
    'fetchByStatus',
    async (t) => await getMoviesByStatus(t, { userId, status }),
  );

  const queryParams = res.locals.input.query;
  if (queryParams) {
    const { sort, order, filter } = queryParams;

    if (filter) {
      const itemFilter = getItemFilter({
        key: filter[0],
        stringSchema: movieStringKeySchema,
        numberSchema: movieNumberKeySchema,
        dateSchema: movieDateKeySchema,
      });
      if (itemFilter) {
        movies = movies.filter((movie) => itemFilter(movie, filter));
      }
    }

    movies = movies.toSorted((a, b) => itemSorter({ a, b, sort, order }));
  }

  res.status(200).json(success(movies));
};

export const addOne = async (_: Request, res: TypedResponse<typeof addOneSchema>) => {
  const { userId, username } = res.locals;
  const movie = res.locals.input.body;

  await db.tx('addOne', async (t) => {
    const { movie_count } = await getItemCountByUserIdForUpdate(t, userId);
    const maxItemCount = config.USER_LIST_ITEM_MAX_COUNT;
    if (movie_count + 1 > maxItemCount) {
      throw new ErrorWithStatus(422, 'movie_list_error', 'Item count exceeds the maximum count');
    }

    const movieId = await postMovie(t, movie, userId);
    await postMovieToUserList(t, movieId, movie);
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username,
      action: 'create',
      table_name: 'movies',
      record_id: movieId,
      new_data: movie,
    });
  });

  res.status(201).json(success([{ name: 'movie_added_to_list', message: 'Movie added to list' }]));
};

export const updateOne = async (_: Request, res: TypedResponse<typeof updateOneSchema>) => {
  const { userId, username } = res.locals;
  const { movieId } = res.locals.input.params;
  const movie = res.locals.input.body;

  const updatedMovie = await db.tx('updateOne', async (t) => {
    const oldMovie = await getMovieById(t, { movieId, userId });
    await updateMovie(t, { movie, movieId, userId });
    const updatedMovie = await getMovieById(t, { movieId, userId });
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username,
      action: 'update',
      table_name: 'movies',
      record_id: movieId,
      old_data: oldMovie,
      new_data: updatedMovie,
    });
    return updatedMovie;
  });

  res.status(200).json(success([updatedMovie]));
};

export const deleteOne = async (_: Request, res: TypedResponse<typeof deleteOneSchema>) => {
  const { movieId } = res.locals.input.params;
  const { userId, username } = res.locals;

  await db.tx('deleteOne', async (t) => {
    const movie = await getMovieById(t, { movieId, userId });
    await t.none({
      text: `DELETE
         FROM movies
         WHERE movie_id = $1
           AND user_id = $2`,
      values: [movieId, userId],
    });
    await addAudit(t, {
      actor_user_id: res.locals.userId,
      username,
      action: 'delete',
      table_name: 'movies',
      record_id: movieId,
      old_data: movie,
    });
  });

  res.status(200).json(success([{ name: 'movie_deleted', message: 'Movie deleted' }]));
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

export const fetchImages = async (_: Request, res: TypedResponse<typeof fetchImagesSchema>) => {
  const query = res.locals.input.query.query;

  const responses = await Promise.allSettled([
    fetchTmdbImages(query),
    fetchFinnaImages(query, 'video'),
  ]);

  const images: string[] = responses
    .filter((response) => response.status === 'fulfilled')
    .flatMap((response) => response.value);

  res.status(200).json(success(images));
};

export const countByStatus = async (_req: Request, res: TypedResponse) => {
  const userId = res.locals.userId;

  const rows = await db.any<StatusCountRow>(
    `SELECT uml.status, COUNT(*) AS count
      FROM user_movie_list uml
      INNER JOIN movies m USING (movie_id)
      WHERE m.user_id = $1
      GROUP BY uml.status`,
    [userId],
  );

  const total = rows.reduce((acc, curr) => acc + curr.count, 0);
  const statuses = [...fillMovieStatuses(rows), { status: 'all', count: total }];
  const result = Object.fromEntries(statuses.map(({ status, count }) => [status, count]));

  res.status(200).json(result);
};
