import {
  type Movie,
  type DbMovie,
  movieDateKeySchema,
  movieStringKeySchema,
} from './model/movie.ts';
import type { MovieStatus } from './model/moviestatus.ts';
import type { ITask } from 'pg-promise';
import { prefixSearchQuery } from './search.ts';
import { getPage } from './pagination.ts';
import type { ListQuery, Pagination } from '../util/pagination.ts';

const moviesQuery = `SELECT m.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.image_url,
                  m.duration,
                  m.year,
                  uml.note,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on
           FROM user_movie_list uml
                    INNER JOIN movies m USING (movie_id)
           WHERE m.user_id = $1`;

export const getAllMovies = async (t: ITask<unknown>, userId: string): Promise<DbMovie[]> => {
  return await t.any({
    text: `${moviesQuery} ORDER BY m.title`,
    values: [userId],
  });
};

export const getMoviesPage = (
  t: ITask<unknown>,
  options: { userId: string; status?: MovieStatus; pagination: Pagination; listQuery: ListQuery },
) =>
  getPage<DbMovie>(t, {
    ...options,
    query: `${moviesQuery}${options.status ? ' AND uml.status = $2' : ''}`,
    values: options.status ? [options.userId, options.status] : [options.userId],
    idColumn: 'movie_id',
    secondarySort: 'title',
    stringKeys: movieStringKeySchema.options,
    dateKeys: movieDateKeySchema.options,
  });

export const getMovieById = async (
  t: ITask<unknown>,
  { movieId, userId }: { movieId: string; userId: string },
): Promise<DbMovie> => {
  return await t.one({
    text: `SELECT uml.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.image_url,
                  m.duration,
                  m.year,
                  uml.note,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on
           FROM user_movie_list uml
                    INNER JOIN movies m USING (movie_id)
           WHERE m.movie_id = $1
             AND m.user_id = $2`,
    values: [movieId, userId],
  });
};

export const getMoviesByStatus = async (
  t: ITask<unknown>,
  { userId, status }: { userId: string; status: MovieStatus },
): Promise<DbMovie[]> => {
  return await t.any({
    text: `SELECT m.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.image_url,
                  m.duration,
                  m.year,
                  uml.note,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on
           FROM user_movie_list uml
                    INNER JOIN movies m USING (movie_id)
           WHERE m.user_id = $1
             AND uml.status = $2
           ORDER BY m.title`,
    values: [userId, status],
  });
};

export const postMovie = async (t: ITask<unknown>, m: Movie, userId: string): Promise<string> => {
  const result = await t.one({
    text: `INSERT INTO movies (title, studio, director, writer, image_url, duration, year, user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING movie_id`,
    values: [m.title, m.studio, m.director, m.writer, m.image_url, m.duration, m.year, userId],
  });
  return result.movie_id;
};

export const postMovieToUserList = async (
  t: ITask<unknown>,
  movieId: string,
  m: Movie,
): Promise<void> => {
  await t.none({
    text: `INSERT INTO user_movie_list (movie_id, status, score, note, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)`,
    values: [movieId, m.status, m.score, m.note, m.start_date, m.end_date],
  });
};

export const updateMovie = async (
  t: ITask<unknown>,
  { movie, movieId, userId }: { movie: Movie; movieId: string; userId: string },
): Promise<void> => {
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
           AND user_id=$9`,
    values: [
      movie.title,
      movie.studio,
      movie.director,
      movie.writer,
      movie.image_url,
      movie.duration,
      movie.year,
      movieId,
      userId,
    ],
  });
  await t.none({
    text: `UPDATE user_movie_list uml
            SET status=$1,
                score=$2,
                note=$3,
                start_date=$4,
                end_date=$5
            FROM movies m
            WHERE uml.movie_id = $6
              AND m.movie_id = uml.movie_id
              AND m.user_id = $7`,
    values: [
      movie.status,
      movie.score,
      movie.note,
      movie.start_date,
      movie.end_date,
      movieId,
      userId,
    ],
  });
};

export const ftsSearch = async (
  t: ITask<unknown>,
  { userId, query }: { userId: string; query: string },
): Promise<DbMovie[]> => {
  const tokens = [...new Set(query.split(/\s+/))];
  const multipleTokens = tokens.length > 1;
  return await t.any<DbMovie>({
    text: `${prefixSearchQuery}
             SELECT movie_id, title, studio, director, writer, image_url, duration, year, note, status, score, start_date, end_date, created_on
             FROM (
               SELECT ${multipleTokens ? 'DISTINCT ON (m.movie_id)' : ''}
                  m.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.image_url,
                  m.duration,
                  m.year,
                  uml.note,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on,
                  query_index, ts_rank(document, search_query.query) AS search_rank
               FROM movies m
               INNER JOIN user_movie_list uml USING (movie_id)
               CROSS JOIN search_query
               WHERE document @@ search_query.query AND m.user_id = $1
               ${multipleTokens ? 'ORDER BY m.movie_id, query_index' : ''}
             ) matches
             ORDER BY query_index, search_rank DESC`,
    values: [userId, tokens],
  });
};

export const likeSearch = async (
  t: ITask<unknown>,
  { userId, query }: { userId: string; query: string },
): Promise<DbMovie[]> => {
  return await t.any<DbMovie>({
    text: `SELECT m.movie_id,
                  m.title,
                  m.studio,
                  m.director,
                  m.writer,
                  m.image_url,
                  m.duration,
                  m.year,
                  uml.note,
                  uml.status,
                  uml.score,
                  uml.start_date,
                  uml.end_date,
                  uml.created_on
               FROM movies m INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
               WHERE m.user_id = $1 AND (
                title ILIKE $2
                  OR studio ILIKE $2
                  OR director ILIKE $2
                  OR writer ILIKE $2)
               LIMIT 100;`,
    values: [userId, `%${query}%`],
  });
};

export const getTop10MovieTitles = async (t: ITask<unknown>, userId: string): Promise<string[]> => {
  return await t.map(
    {
      text: `SELECT m.title
           FROM user_movie_list uml
           INNER JOIN movies m USING (movie_id)
           WHERE m.user_id = $1
             AND uml.status = 'completed'
           ORDER BY uml.score DESC,
                    uml.end_date DESC
           LIMIT 10;`,
      values: [userId],
    },
    undefined,
    (row) => row.title,
  );
};
