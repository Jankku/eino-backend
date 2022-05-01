import { QueryConfig } from 'pg';
import Logger from '../util/logger';
import { query } from './config';
import Movie from './model/movie';
import MovieStatus from './model/moviestatus';

type DbMovie = {
  movie_id: string;
  title: string;
  studio: string;
  director: string;
  writer: string;
  duration: number;
  year: number;
  status: MovieStatus;
  score: number;
  start_date: string;
  end_date: string;
  created_on: string;
};
const getAllMovies = async (username: string): Promise<DbMovie[]> => {
  const getMoviesQuery: QueryConfig = {
    text: `SELECT m.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.duration,
                  m.year,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on
           FROM user_movie_list uml
                    INNER JOIN movies m USING (movie_id)
           WHERE uml.username = m.submitter
             AND uml.username = $1
           ORDER BY m.title`,
    values: [username],
  };

  try {
    const { rows } = await query(getMoviesQuery);
    return rows;
  } catch (error) {
    Logger.error((error as Error).stack);
  }

  return [];
};

const getMoviesByStatus = async (username: string, status: MovieStatus): Promise<DbMovie[]> => {
  const getMoviesByStatusQuery: QueryConfig = {
    text: `SELECT m.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.duration,
                  m.year,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on
           FROM user_movie_list uml
                    INNER JOIN movies m USING (movie_id)
           WHERE uml.username = m.submitter
             AND uml.username = $1
             AND uml.status = $2
           ORDER BY m.title`,
    values: [username, status],
  };

  try {
    const { rows } = await query(getMoviesByStatusQuery);
    return rows;
  } catch (error) {
    Logger.error((error as Error).stack);
  }

  return [];
};

const postMovie = async (m: Movie): Promise<string> => {
  let movieId = '';
  try {
    const insertMovieQuery: QueryConfig = {
      text: `INSERT INTO movies (title, studio, director, writer, duration, year, submitter)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING movie_id`,
      values: [m.title, m.studio, m.director, m.writer, m.duration, m.year, m.submitter],
    };
    const { rows } = await query(insertMovieQuery);
    movieId = rows[0].movie_id;
  } catch (error) {
    Logger.error((error as Error).stack);
  }

  return movieId;
};

export { getAllMovies, getMoviesByStatus, postMovie };
