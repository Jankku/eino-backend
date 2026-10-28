import { NextFunction, Request } from 'express';
import { Logger } from '../util/logger';
import {
  ftsSearch,
  getAllMovies,
  getMovieById,
  getMoviesByStatus,
  likeSearch,
  postMovie,
  postMovieToUserList,
  updateMovie,
} from '../db/movies';
import { success } from '../util/response';
import { db } from '../db/config';
import { config } from '../config';
import { getItemCountByUsernameForUpdate } from '../db/users';
import { ErrorWithStatus } from '../util/errorhandler';
import { fetchTmdbImages } from './third-party/tmdb';
import { fetchFinnaImages } from './third-party/finna';
import {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchSchema,
  updateOneSchema,
} from '../routes/movies';
import { TypedResponse } from '../util/zod';
import {
  DbMovie,
  movieNumberKeySchema,
  movieSortSchema,
  movieStringKeySchema,
  movieDateKeySchema,
} from '../db/model/movie';
import { getItemFilter, itemSorter } from '../util/sort';
import { addAudit } from '../db/audit';
import { fillMovieStatuses, StatusCountRow } from '../util/status';

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
    Logger.error((error as Error).stack);
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
    Logger.error((error as Error).stack);
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
    Logger.error((error as Error).stack);
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
    Logger.error((error as Error).stack);
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
    Logger.error((error as Error).stack);
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
    Logger.error((error as Error).stack);
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
    const queryAsArray = queryString.split(/\s+/);
    const username = res.locals.username;

    const { results } = await db.task('search', async (t) => {
      const results: DbMovie[] = [];

      for (const queryPart of queryAsArray) {
        const rows = await ftsSearch(t, { username, query: queryPart });
        // Push only unique results
        for (const row of rows) {
          if (results.every((item) => item.movie_id !== row.movie_id)) {
            results.push(row);
          }
        }
      }

      if (results.length === 0) {
        const rows = await likeSearch(t, { username, query: queryString });
        // Push only unique results
        for (const row of rows) {
          if (results.every((item) => item.movie_id !== row.movie_id)) {
            results.push(row);
          }
        }
      }
      return { results };
    });

    res.status(200).json(success(results));
  } catch (error) {
    Logger.error((error as Error).stack);
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
    Logger.error((error as Error).stack);
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
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'movie_list_error', "Couldn't count books"));
  }
};
