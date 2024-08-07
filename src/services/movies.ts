import { NextFunction, Request, Response } from 'express';
import Logger from '../util/logger';
import {
  getAllMovies,
  getMovieById,
  getMoviesByStatus,
  postMovie,
  postMovieToUserList,
} from '../db/movies';
import { success } from '../util/response';
import { db } from '../db/config';
import MovieStatus from '../db/model/moviestatus';
import { ErrorWithStatus } from '../util/errorhandler';
import { fetchTmdbImages } from './third-party/tmdb';
import { fetchFinnaImages } from './third-party/finna';
import DbMovie from '../db/model/dbmovie';
import { movieSchema, movieSortSchema } from '../db/model/movie';
import { itemSorter } from '../util/sort';

const fetchOne = async (req: Request, res: Response, next: NextFunction) => {
  const { movieId } = req.params;
  const { username } = res.locals;

  try {
    const movie = await getMovieById(movieId, username);
    res.status(200).json(success(movie));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movie"));
  }
};

const fetchAll = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;

  try {
    let movies = await getAllMovies(username);

    const sortQuery = movieSortSchema.safeParse(req.query);
    if (sortQuery.success) {
      const { sort, order } = sortQuery.data;
      movies = movies.toSorted((a, b) => itemSorter(a, b, sort, order));
    }

    res.status(200).json(success(movies));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movies"));
  }
};

const fetchByStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const status = req.params.status as MovieStatus;

  try {
    let movies = await getMoviesByStatus(username, status);

    const sortQuery = movieSortSchema.safeParse(req.query);
    if (sortQuery.success) {
      const { sort, order } = sortQuery.data;
      movies = movies.toSorted((a, b) => itemSorter(a, b, sort, order));
    }

    res.status(200).json(success(movies));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movies"));
  }
};

const addOne = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const movie = movieSchema.parse(req.body);

  try {
    await db.tx('add-movie', async (t) => {
      const movieId = await postMovie(t, movie, username);
      await postMovieToUserList(t, movieId, movie, username);
    });

    res
      .status(201)
      .json(success([{ name: 'movie_added_to_list', message: 'Movie added to list' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't create movie"));
  }
};

const updateOne = async (req: Request, res: Response, next: NextFunction) => {
  const { movieId } = req.params;
  const { username } = res.locals;
  const {
    title,
    studio,
    director,
    writer,
    image_url,
    duration,
    year,
    status,
    score,
    start_date,
    end_date,
  } = req.body;

  try {
    await db.tx('update-movie', async (t) => {
      await t.none({
        text: `UPDATE movies
        SET title=$1,
            studio=$2,
            director=$3,
            writer=$4,
            image_url=$5,
            duration=$6,
            year=$7
        WHERE movie_id=$8
          AND submitter=$9`,
        values: [title, studio, director, writer, image_url, duration, year, movieId, username],
      });
      await t.none({
        text: `UPDATE user_movie_list
           SET status=$1,
               score=$2,
               start_date=$3,
               end_date=$4
           WHERE movie_id = $5`,
        values: [status, score, start_date, end_date, movieId],
      });
    });
    const updatedMovie = await getMovieById(movieId, username);
    res.status(200).json(success(updatedMovie));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't update movie"));
  }
};

const deleteOne = async (req: Request, res: Response, next: NextFunction) => {
  const { movieId } = req.params;
  const { username } = res.locals;

  try {
    await db.none({
      text: `DELETE
           FROM movies
           WHERE movie_id = $1
             AND submitter = $2`,
      values: [movieId, username],
    });
    res.status(200).json(success([{ name: 'movie_deleted', message: 'Movie deleted' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't delete movie"));
  }
};

const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryString = String(req.query.query).trim();
    const queryAsArray = queryString.split(' ');
    const { username } = res.locals;
    const resultArray: DbMovie[] = [];

    for (const queryPart of queryAsArray) {
      // accurate query
      const rows = await db.any({
        text: `SELECT m.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.image_url,
                  m.duration,
                  m.year,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on
               FROM movies m INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
               WHERE document @@ to_tsquery('english', $2)
                 AND submitter = $1
               ORDER BY ts_rank(document, plainto_tsquery($2)) DESC;`,
        values: [username, `${queryPart}:*`],
      });
      // Push only unique results
      for (const row of rows) {
        if (!resultArray.some((item) => item.movie_id === row.movie_id)) {
          resultArray.push(row);
        }
      }
    }

    if (resultArray.length === 0) {
      // less accurate query
      const rows = await db.any({
        text: `SELECT m.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.image_url,
                  m.duration,
                  m.year,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on
               FROM movies m INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
               WHERE submitter = $1 AND (
                title ILIKE $2
                  OR studio ILIKE $2
                  OR director ILIKE $2
                  OR writer ILIKE $2)
               LIMIT 100;`,
        values: [username, `%${queryString}%`],
      });
      // Push only unique results
      for (const row of rows) {
        if (!resultArray.some((item) => item.movie_id === row.movie_id)) {
          resultArray.push(row);
        }
      }
    }

    res.status(200).json(success(resultArray));
  } catch {
    next(new ErrorWithStatus(500, 'movie_list_error', 'Search failed'));
  }
};

const fetchImages = async (req: Request, res: Response, next: NextFunction) => {
  const query = req.query.query as string;

  try {
    const responses = (await Promise.allSettled([
      fetchTmdbImages(query),
      fetchFinnaImages(query, 'video'),
    ])) as {
      status: 'fulfilled' | 'rejected';
      value: string[];
    }[];

    const images: string[] = responses
      .filter((response) => response.status === 'fulfilled')
      .flatMap((response) => response.value);

    res.status(200).json(success(images));
  } catch {
    next(new ErrorWithStatus(500, 'movie_list_error', 'Failed to fetch images'));
  }
};

export { fetchOne, fetchAll, fetchByStatus, addOne, updateOne, deleteOne, search, fetchImages };
