import { db } from './config';
import DbMovie from './model/dbmovie';
import Movie from './model/movie';
import MovieStatus from './model/moviestatus';
import { ITask } from 'pg-promise';

const getAllMovies = async (username: string, client?: ITask<unknown>): Promise<DbMovie[]> => {
  const c = client || db;
  return await c.any({
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
           FROM user_movie_list uml
                    INNER JOIN movies m USING (movie_id)
           WHERE uml.username = m.submitter
             AND uml.username = $1
           ORDER BY m.title`,
    values: [username],
  });
};

const getMovieById = async (movieId: string, username: string): Promise<DbMovie[]> => {
  return await db.any({
    text: `SELECT uml.movie_id,
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
           FROM user_movie_list uml,
                movies m
           WHERE uml.movie_id = m.movie_id
             AND uml.movie_id = $1
             AND m.submitter = $2`,
    values: [movieId, username],
  });
};

const getMoviesByStatus = async (username: string, status: MovieStatus): Promise<DbMovie[]> => {
  return await db.any({
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
           FROM user_movie_list uml
                    INNER JOIN movies m USING (movie_id)
           WHERE uml.username = m.submitter
             AND uml.username = $1
             AND uml.status = $2
           ORDER BY m.title`,
    values: [username, status],
  });
};

const postMovie = async (client: ITask<unknown>, m: Movie, submitter: string): Promise<string> => {
  const result = await client.one({
    text: `INSERT INTO movies (title, studio, director, writer, image_url, duration, year, submitter)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING movie_id`,
    values: [m.title, m.studio, m.director, m.writer, m.image_url, m.duration, m.year, submitter],
  });
  return result.movie_id;
};

const postMovieToUserList = async (
  client: ITask<unknown>,
  movieId: string,
  m: Movie,
  username: string,
): Promise<void> => {
  await client.none({
    text: `INSERT INTO user_movie_list (movie_id, username, status, score, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
    values: [movieId, username, m.status, m.score, m.start_date, m.end_date],
  });
};

const getTop10MovieTitles = async (username: string): Promise<string[]> => {
  return await db.map(
    {
      text: `SELECT CASE
                WHEN char_length(m.title) > 25
                  THEN concat(left(m.title, 22), '...')
                  ELSE m.title
                END
           FROM user_movie_list uml
                    INNER JOIN movies m USING (movie_id)
           WHERE uml.username = m.submitter
             AND uml.username = $1
             AND uml.status = 'completed'
           ORDER BY uml.score DESC,
                      uml.end_date DESC
           LIMIT 10;`,
      values: [username],
    },
    undefined,
    (row) => row.title,
  );
};

export {
  getAllMovies,
  getMovieById,
  getMoviesByStatus,
  postMovie,
  postMovieToUserList,
  getTop10MovieTitles,
};
