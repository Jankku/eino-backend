import { Movie, DbMovie } from './model/movie';
import { MovieStatus } from './model/moviestatus';
import { ITask } from 'pg-promise';

export const getAllMovies = async (t: ITask<unknown>, username: string): Promise<DbMovie[]> => {
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
           WHERE uml.username = m.submitter
             AND uml.username = $1
           ORDER BY m.title`,
    values: [username],
  });
};

export const getMovieById = async (
  t: ITask<unknown>,
  { movieId, username }: { movieId: string; username: string },
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
           FROM user_movie_list uml,
                movies m
           WHERE uml.movie_id = m.movie_id
             AND uml.movie_id = $1
             AND m.submitter = $2`,
    values: [movieId, username],
  });
};

export const getMoviesByStatus = async (
  t: ITask<unknown>,
  { username, status }: { username: string; status: MovieStatus },
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
           WHERE uml.username = m.submitter
             AND uml.username = $1
             AND uml.status = $2
           ORDER BY m.title`,
    values: [username, status],
  });
};

export const postMovie = async (
  t: ITask<unknown>,
  m: Movie,
  submitter: string,
): Promise<string> => {
  const result = await t.one({
    text: `INSERT INTO movies (title, studio, director, writer, image_url, duration, year, submitter)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING movie_id`,
    values: [m.title, m.studio, m.director, m.writer, m.image_url, m.duration, m.year, submitter],
  });
  return result.movie_id;
};

export const postMovieToUserList = async (
  t: ITask<unknown>,
  movieId: string,
  m: Movie,
  username: string,
): Promise<void> => {
  await t.none({
    text: `INSERT INTO user_movie_list (movie_id, username, status, score, note, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    values: [movieId, username, m.status, m.score, m.note, m.start_date, m.end_date],
  });
};

export const updateMovie = async (
  t: ITask<unknown>,
  { movie, movieId, username }: { movie: Movie; movieId: string; username: string },
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
           AND submitter=$9`,
    values: [
      movie.title,
      movie.studio,
      movie.director,
      movie.writer,
      movie.image_url,
      movie.duration,
      movie.year,
      movieId,
      username,
    ],
  });
  await t.none({
    text: `UPDATE user_movie_list
            SET status=$1,
                score=$2,
                note=$3,
                start_date=$4,
                end_date=$5
            WHERE movie_id = $6`,
    values: [movie.status, movie.score, movie.note, movie.start_date, movie.end_date, movieId],
  });
};

export const ftsSearch = async (
  t: ITask<unknown>,
  { username, query }: { username: string; query: string },
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
               WHERE document @@ to_tsquery('english', $2)
                 AND submitter = $1
               ORDER BY ts_rank(document, plainto_tsquery($2)) DESC;`,
    values: [username, `${query}:*`],
  });
};

export const likeSearch = async (
  t: ITask<unknown>,
  { username, query }: { username: string; query: string },
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
               WHERE submitter = $1 AND (
                title ILIKE $2
                  OR studio ILIKE $2
                  OR director ILIKE $2
                  OR writer ILIKE $2)
               LIMIT 100;`,
    values: [username, `%${query}%`],
  });
};

export const getTop10MovieTitles = async (
  t: ITask<unknown>,
  username: string,
): Promise<string[]> => {
  return await t.map(
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
