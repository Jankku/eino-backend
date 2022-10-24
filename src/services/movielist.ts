import { NextFunction, Request, Response } from 'express';
import { QueryConfig } from 'pg';
import Logger from '../util/logger';
import { getAllMovies, getMovieById, getMoviesByStatus, postMovie } from '../db/movies';
import { success } from '../util/response';
import Movie from '../db/model/movie';
import { query, transaction } from '../db/config';
import MovieStatus from '../db/model/moviestatus';
import { ErrorWithStatus } from '../util/errorhandler';
import MovieSearchResult from '../db/model/moviesearchresult';

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
    const movies = await getAllMovies(username);
    res.status(200).json(success(movies));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movies"));
  }
};

const fetchByStatus = async (
  req: Request,
  res: Response,
  status: MovieStatus,
  next: NextFunction
) => {
  const { username } = res.locals;

  try {
    const movies = await getMoviesByStatus(username, status);
    res.status(200).json(success(movies));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'movie_list_error', "Couldn't find movies"));
  }
};

const addOne = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const { title, studio, director, writer, duration, year, status, score, start_date, end_date } =
    req.body;
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
    await transaction(async (client) => {
      const movieId = await postMovie(client, movie);
      const addMovieToUserListQuery: QueryConfig = {
        text: `INSERT INTO user_movie_list (movie_id, username, status, score, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
        values: [movieId, username, status, score, start_date, end_date],
      };
      await client.query(addMovieToUserListQuery);
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
  const { title, studio, director, writer, duration, year, status, score, start_date, end_date } =
    req.body;

  const updateMovieQuery: QueryConfig = {
    text: `
        UPDATE movies
        SET title    = $1,
            studio   = $2,
            director = $3,
            writer   = $4,
            duration = $5,
            year     = $6
        WHERE movie_id = $7
          AND submitter = $8
        RETURNING movie_id, title, studio, director, writer, duration, year`,
    values: [title, studio, director, writer, duration, year, movieId, username],
  };

  const updateUserListQuery: QueryConfig = {
    text: `UPDATE user_movie_list
           SET status=$1,
               score=$2,
               start_date=$3,
               end_date=$4
           WHERE movie_id = $5`,
    values: [status, score, start_date, end_date, movieId],
  };

  try {
    await transaction(async (client) => {
      await client.query(updateMovieQuery);
      await client.query(updateUserListQuery);
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

  const deleteMovieQuery: QueryConfig = {
    text: `DELETE
           FROM movies
           WHERE movie_id = $1
             AND submitter = $2`,
    values: [movieId, username],
  };

  try {
    await query(deleteMovieQuery);
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
    const resultArray: MovieSearchResult[] = [];

    for (const queryPart of queryAsArray) {
      const accurateSearchQuery: QueryConfig = {
        text: `SELECT m.movie_id, m.title, m.studio, m.director, m.writer, uml.score
               FROM movies m INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
               WHERE document @@ to_tsquery('english', $2)
                 AND submitter = $1
               ORDER BY ts_rank(document, plainto_tsquery($2)) DESC;`,
        values: [username, `${queryPart}:*`],
      };

      const { rows } = await query(accurateSearchQuery);
      // Push only unique results
      rows.forEach((row) => {
        if (!resultArray.some((item) => item.movie_id === row.movie_id)) {
          resultArray.push(row);
        }
      });
    }

    if (resultArray.length === 0) {
      const lessAccurateSearchQuery: QueryConfig = {
        text: `SELECT m.movie_id, m.title, m.studio, m.director, m.writer, uml.score
               FROM movies m INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
               WHERE title ILIKE $1
                  OR studio ILIKE $1
                  OR director ILIKE $1
                  OR writer ILIKE $1
               LIMIT 100;`,
        values: [`%${queryString}%`],
      };

      const { rows } = await query(lessAccurateSearchQuery);
      // Push only unique results
      rows.forEach((row) => {
        if (!resultArray.some((item) => item.movie_id === row.movie_id)) {
          resultArray.push(row);
        }
      });
    }

    res.status(200).json(success(resultArray));
  } catch (error) {
    next(new ErrorWithStatus(500, 'movie_list_error', 'Search failed'));
  }
};

export { fetchOne, fetchAll, fetchByStatus, addOne, updateOne, deleteOne, search };
