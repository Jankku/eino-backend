import Logger from '../util/logger';
import { query } from './config';
import Movie from './model/movie';
import Status from './model/moviestatus';

const getMoviesByStatus = async (username: string, status: Status): Promise<any[]> => {
  const getMoviesQuery = {
    text: 'SELECT * FROM user_movie_list WHERE username = $1 AND status = $2',
    values: [username, status],
  };

  try {
    const result = await query(getMoviesQuery);
    if (result?.rows.length > 0) return result.rows;
  } catch (err) {
    Logger.error(err.stack);
  }

  return [];
};

const postMovie = async (m: Movie): Promise<string> => {
  let movieId = '';
  try {
    const insertMovieQuery = {
      text: 'INSERT INTO movies (title, studio, director, writer, duration, year, submitter) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING movie_id',
      values: [m.title, m.studio, m.director, m.writer, m.duration, m.year, m.submitter],
    };
    const result = await query(insertMovieQuery);
    movieId = result.rows[0].movie_id;
  } catch (err) {
    Logger.error(err.stack);
  }

  return movieId;
};

export {
  getMoviesByStatus,
  postMovie,
};
