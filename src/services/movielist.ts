import { NextFunction, Request, Response } from 'express';
import Logger from '../util/logger';
import { postMovie, getMoviesByStatus, getAllMovies } from '../db/movies';
import { success } from '../util/response';
import Movie from '../db/model/movie';
import { pool, query } from '../db/config';
import MovieStatus from '../db/model/moviestatus';
import { ErrorHandler } from '../util/errorhandler';

const getMovieById = async (req: Request, res: Response, next: NextFunction) => {
  const { movieId } = req.params;
  const { username } = res.locals;

  const getMovieQuery = {
    text: 'SELECT uml.movie_id, m.title, m.studio, m.director, m.writer, m.duration, m.year, uml.status, uml.score, uml.start_date, uml.end_date, uml.created_on FROM user_movie_list uml, movies m WHERE uml.movie_id=m.movie_id AND uml.movie_id=$1 AND m.submitter=$2',
    values: [movieId, username],
  };

  try {
    const result = await query(getMovieQuery);

    if (result.rowCount === 0) {
      next(new ErrorHandler(422, 'movie_list_error', 'Couldn\'t find movie'));
      return;
    }

    res.status(200).json(success(result.rows));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'movie_list_error', 'Couldn\'t find movie'));
  }
};

const fetchAllMovies = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const movies = await getAllMovies(username);
    res.status(200).json(success(movies));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'movie_list_error', 'Couldn\'t find movies'));
  }
};

const fetchList = async (req: Request, res: Response, status: MovieStatus, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const movies = await getMoviesByStatus(username, status);
    res.status(200).json(success(movies));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'movie_list_error', 'Couldn\'t find movies'));
  }
};

const getFullMovieList = (req: Request, res: Response, next: NextFunction) => fetchAllMovies(req, res, next);
const getCompletedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'completed', next);
const getWatchingList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'watching', next);
const getOnHoldList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'on-hold', next);
const getDroppedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'dropped', next);
const getPlannedList = (req: Request, res: Response, next: NextFunction) => fetchList(req, res, 'planned', next);

const addMovieToList = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  const { username } = res.locals;
  const {
    title, studio, director, writer, duration, year, status, score, start_date, end_date,
  } = req.body;
  const movie: Movie = {
    title,
    studio,
    director,
    writer,
    duration,
    year,
    submitter: username,
  };

  try {
    await client.query('BEGIN');
    try {
      // Insert movie to movies table
      await postMovie(movie).then((movieId) => {
        // Insert movie to user list
        const addMovieToUserListQuery = {
          text: 'INSERT INTO user_movie_list (movie_id, username, status, score, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6)',
          values: [movieId, username, status, score, start_date, end_date],
        };
        query(addMovieToUserListQuery);
        res
          .status(201)
          .json(success([{ name: 'movie_added_to_list', message: 'Movie added to list' }]));
      });
      await client.query('END');
    } catch (err) {
      await client.query('ROLLBACK');

      Logger.error(err.stack);
      next(new ErrorHandler(422, 'movie_list_error', 'Couldn\'t create movie'));
    }
  } finally {
    client.release();
  }
};

const updateMovie = async (req: Request, res: Response, next: NextFunction) => {
  const { movieId } = req.params;
  const { username } = res.locals;
  const {
    title, studio, director, writer, duration, year, status, score, start_date, end_date,
  } = req.body;

  const updateMovieQuery = {
    text: 'UPDATE movies SET title=$1, studio=$2, director=$3, writer=$4, duration=$5, year=$6 WHERE movie_id=$7 AND submitter=$8 RETURNING movie_id, title, studio, director, writer, duration, year',
    values: [title, studio, director, writer, duration, year, movieId, username],
  };

  const updateUserListQuery = {
    text: 'UPDATE user_movie_list SET status=$1, score=$2, start_date=$3, end_date=$4 WHERE movie_id=$5',
    values: [status, score, start_date, end_date, movieId],
  };

  try {
    await query(updateMovieQuery);
    await query(updateUserListQuery);
    res.status(200).json(success([{ name: 'movie_updated', message: 'Movie successfully updated' }]));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'movie_list_error', 'Couldn\'t update movie'));
  }
};

const deleteMovie = async (req: Request, res: Response, next: NextFunction) => {
  const { movieId } = req.params;
  const { username } = res.locals;

  const deleteMovieQuery = {
    text: 'DELETE FROM movies WHERE movie_id=$1 AND submitter=$2',
    values: [movieId, username],
  };

  try {
    await query(deleteMovieQuery);
    res.status(200).json(success([{ name: 'movie_deleted', message: 'Movie deleted' }]));
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(422, 'movie_list_error', 'Couldn\'t delete movie'));
  }
};

export {
  getMovieById,
  getFullMovieList,
  getCompletedList,
  getWatchingList,
  getOnHoldList,
  getDroppedList,
  getPlannedList,
  addMovieToList,
  updateMovie,
  deleteMovie,
};
