import { QueryConfig } from 'pg';
import { fillAndSortResponse } from '../util/profile';
import { query } from './config';

type UserInfo = {
  user_id: string;
  registration_date: string;
};

const getUserInfo = async (username: string): Promise<UserInfo> => {
  const usernameQuery: QueryConfig = {
    text: `SELECT user_id, created_on as registration_date
           FROM users
           WHERE username = $1`,
    values: [username],
  };
  const { rows }: { rows: UserInfo[] } = await query(usernameQuery);
  return rows[0];
};

type BookData = {
  count: number;
  pages_read: number;
  score_average: number;
};

const getBookData = async (username: string): Promise<BookData> => {
  const bookDataQuery: QueryConfig = {
    text: `SELECT * FROM
            (SELECT count(*) FROM books WHERE submitter = $1) count,
            (SELECT coalesce(sum(b.pages), 0) as pages_read, coalesce(round(avg(ubl.score), 1), 0) AS average
            FROM books b
            INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
            WHERE submitter = $1 AND ubl.status != 'planned') pages_and_avg_score`,
    values: [username],
  };

  const pagesAndAvgScore = await query(bookDataQuery);
  const response: BookData = {
    count: pagesAndAvgScore.rows[0].count,
    pages_read: pagesAndAvgScore.rows[0].pages_read,
    score_average: pagesAndAvgScore.rows[0].average,
  };
  return response;
};

type MovieData = {
  count: number;
  watch_time: number;
  score_average: number;
};

const getMovieData = async (username: string): Promise<MovieData> => {
  const movieDataQuery: QueryConfig = {
    text: `SELECT * FROM
            (SELECT count(*) FROM movies WHERE submitter = $1) count,
            (SELECT coalesce(sum(m.duration) / 60, 0) as watch_time, coalesce(round(avg(uml.score), 1), 0) AS average
            FROM movies m INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
            WHERE submitter = $1 AND uml.status != 'planned') watch_time_and_avg_score`,
    values: [username],
  };

  const movieData = await query(movieDataQuery);
  const response: MovieData = {
    count: movieData.rows[0].count,
    watch_time: movieData.rows[0].watch_time,
    score_average: movieData.rows[0].average,
  };
  return response;
};

type ItemScore = {
  score: number;
  count: number;
};

const getBookScores = async (username: string): Promise<ItemScore[]> => {
  const scoreQuery: QueryConfig = {
    text: `SELECT ubl.score, count(ubl.score)
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE submitter = $1 AND ubl.status != 'planned'
           GROUP BY ubl.score;`,
    values: [username],
  };
  const { rows }: { rows: ItemScore[] } = await query(scoreQuery);
  return await fillAndSortResponse(rows);
};

const getMovieScores = async (username: string): Promise<ItemScore[]> => {
  const scoreQuery: QueryConfig = {
    text: `SELECT uml.score, count(uml.score)
           FROM movies m
                    INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
           WHERE submitter = $1 AND uml.status != 'planned'
           GROUP BY uml.score;`,
    values: [username],
  };

  const { rows }: { rows: ItemScore[] } = await query(scoreQuery);
  return await fillAndSortResponse(rows);
};

type ProfileData = {
  userInfo: UserInfo;
  bookData: BookData;
  movieData: MovieData;
  bookScores: ItemScore[];
  movieScores: ItemScore[];
};
const getProfileData = async (username: string): Promise<ProfileData> => {
  const data = await Promise.all([
    getUserInfo(username),
    getBookData(username),
    getMovieData(username),
    getBookScores(username),
    getMovieScores(username),
  ]);
  return {
    userInfo: data[0],
    bookData: data[1],
    movieData: data[2],
    bookScores: data[3],
    movieScores: data[4],
  };
};

export { getProfileData, ItemScore };
