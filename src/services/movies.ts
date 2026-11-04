import type { NextFunction, Request } from 'express';
import { logError } from '../util/logger.ts';
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
import { getItemCountByUsernameForUpdate } from '../db/users.ts';
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
  const { pagination, listQuery, username } = res.locals;
  if (!pagination || !listQuery) {
    next();
    return;
  }
  try {
    const page = await db.tx({ mode: paginationMode }, async (t) =>
      getMoviesPage(t, {
        username,
        pagination,
        listQuery,
        status: req.params.status ? res.locals.input.params.status : undefined,
      }),
    );
    res.status(200).json(page);
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movies"));
  }
};

export const fetchOne = async (
  _: Request,
  res: TypedResponse<typeof fetchOneSchema>,
  next: NextFunction,
) => {
  const { movieId } = res.locals.input.params;
  const username = res.locals.username;

  try {
    const movie = await db.task(
      'fetchOne',
      async (t) => await getMovieById(t, { movieId, username }),
    );
    res.status(200).json(success([movie]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movie"));
  }
};

export const fetchAll = async (req: Request, res: TypedResponse, next: NextFunction) => {
  const username = res.locals.username;

  try {
    let movies = await db.task('fetchAll', async (t) => await getAllMovies(t, username));

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
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movies"));
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
    let movies = await db.task(
      'fetchByStatus',
      async (t) => await getMoviesByStatus(t, { username, status }),
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
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movies"));
  }
};

export const addOne = async (
  _: Request,
  res: TypedResponse<typeof addOneSchema>,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const movie = res.locals.input.body;

  try {
    await db.tx('addOne', async (t) => {
      const { movie_count } = await getItemCountByUsernameForUpdate(t, username);
      const maxItemCount = config.USER_LIST_ITEM_MAX_COUNT;
      if (movie_count + 1 > maxItemCount) {
        throw new ErrorWithStatus(422, 'movie_list_error', 'Item count exceeds the maximum count');
      }

      const movieId = await postMovie(t, movie, username);
      await postMovieToUserList(t, movieId, movie, username);
      await addAudit(t, {
        actor_user_id: res.locals.userId,
        username,
        action: 'create',
        table_name: 'movies',
        record_id: movieId,
        new_data: movie,
      });
    });

    res
      .status(201)
      .json(success([{ name: 'movie_added_to_list', message: 'Movie added to list' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
      return;
    }
    logError(error);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't create movie"));
  }
};

export const updateOne = async (
  _: Request,
  res: TypedResponse<typeof updateOneSchema>,
  next: NextFunction,
) => {
  const { movieId } = res.locals.input.params;
  const username = res.locals.username;
  const movie = res.locals.input.body;

  try {
    const { updatedMovie } = await db.tx('updateOne', async (t) => {
      const oldMovie = await getMovieById(t, { movieId, username });
      await updateMovie(t, { movie, movieId, username });
      const updatedMovie = await getMovieById(t, { movieId, username });
      await addAudit(t, {
        actor_user_id: res.locals.userId,
        username,
        action: 'update',
        table_name: 'movies',
        record_id: movieId,
        old_data: oldMovie,
        new_data: updatedMovie,
      });
      return { updatedMovie };
    });
    res.status(200).json(success([updatedMovie]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't update movie"));
  }
};

export const deleteOne = async (
  _: Request,
  res: TypedResponse<typeof deleteOneSchema>,
  next: NextFunction,
) => {
  const { movieId } = res.locals.input.params;
  const username = res.locals.username;

  try {
    await db.tx('deleteOne', async (t) => {
      const movie = await getMovieById(t, { movieId, username });
      await t.none({
        text: `DELETE
           FROM movies
           WHERE movie_id = $1
             AND submitter = $2`,
        values: [movieId, username],
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
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't delete movie"));
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
    const username = res.locals.username;

    const results = await db.task('search', async (t) => {
      const matches = await ftsSearch(t, { username, query: queryString });
      return matches.length > 0 ? matches : await likeSearch(t, { username, query: queryString });
    });

    res.status(200).json(success(results));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'movie_list_error', 'Search failed'));
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
      fetchTmdbImages(query),
      fetchFinnaImages(query, 'video'),
    ]);

    const images: string[] = responses
      .filter((response) => response.status === 'fulfilled')
      .flatMap((response) => response.value);

    res.status(200).json(success(images));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'movie_list_error', 'Failed to fetch images'));
  }
};

export const countByStatus = async (req: Request, res: TypedResponse, next: NextFunction) => {
  const username = res.locals.username;

  try {
    const rows = await db.any<StatusCountRow>(
      `SELECT status, COUNT(*) AS count
        FROM user_movie_list
        WHERE username = $1
        GROUP BY status`,
      [username],
    );

    const total = rows.reduce((acc, curr) => acc + curr.count, 0);
    const statuses = [...fillMovieStatuses(rows), { status: 'all', count: total }];
    const result = Object.fromEntries(statuses.map(({ status, count }) => [status, count]));

    res.status(200).json(result);
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'movie_list_error', "Couldn't count books"));
  }
};
