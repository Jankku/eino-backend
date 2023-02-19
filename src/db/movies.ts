import { PoolClient, QueryConfig } from 'pg';
import { query } from './config';
import DbMovie from './model/dbmovie';
import Movie from './model/movie';
import MovieStatus from './model/moviestatus';

const getAllMovies = async (username: string): Promise<DbMovie[]> => {
  const getMoviesQuery: QueryConfig = {
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
  };
  const { rows } = await query(getMoviesQuery);
  return rows;
};

const getMovieById = async (movieId: string, username: string): Promise<DbMovie[]> => {
  const getMovieQuery: QueryConfig = {
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
  };
  const { rows } = await query(getMovieQuery);
  return rows;
};

const getMoviesByStatus = async (username: string, status: MovieStatus): Promise<DbMovie[]> => {
  const getMoviesByStatusQuery: QueryConfig = {
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
  };
  const { rows } = await query(getMoviesByStatusQuery);
  return rows;
};

const postMovie = async (client: PoolClient, m: Movie): Promise<string> => {
  const insertMovieQuery: QueryConfig = {
    text: `INSERT INTO movies (title, studio, director, writer, image_url, duration, year, submitter)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING movie_id`,
    values: [m.title, m.studio, m.director, m.writer, m.image_url, m.duration, m.year, m.submitter],
  };
  const { rows } = await client.query(insertMovieQuery);
  return rows[0].movie_id;
};

const getTop10MovieTitles = async (username: string): Promise<string[]> => {
  const getTopMoviesQuery: QueryConfig = {
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
  };
  const { rows }: { rows: { title: string }[] } = await query(getTopMoviesQuery);
  return rows.map(({ title }) => title);
};

export { getAllMovies, getMovieById, getMoviesByStatus, postMovie, getTop10MovieTitles };
