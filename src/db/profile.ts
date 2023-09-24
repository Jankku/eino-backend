import { QueryConfig } from 'pg';
import { fillAndSortResponse } from '../util/profile';
import { query } from './config';
import { movieStatuses } from './model/moviestatus';
import { bookStatuses } from './model/bookstatus';

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

type StatusRow = {
  status: string;
  count: number;
};

type BookDataV2 = {
  count: Record<string, number>;
  pages_read: number;
  score_average: number;
};

const fillBookStatuses = (rows: StatusRow[]): StatusRow[] => {
  return bookStatuses.map((status) => {
    const row = rows.find((row) => row.status === status);
    return { status, count: row?.count || 0 };
  });
};

const getBookDataV2 = async (username: string): Promise<BookDataV2> => {
  const bookDataQuery: QueryConfig = {
    text: `SELECT * FROM
            (SELECT ubl.status, coalesce(count(*), 0) AS count
              FROM books b
              INNER JOIN user_book_list ubl ON b.book_id=ubl.book_id
              WHERE b.submitter = $1
              GROUP BY ubl.status) AS count,
            (SELECT coalesce(sum(b.pages), 0) as pages_read, coalesce(round(avg(ubl.score), 1), 0) AS average
              FROM books b
              INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
              WHERE submitter = $1 AND ubl.status != 'planned') pages_and_avg_score`,
    values: [username],
  };

  const { rows } = await query(bookDataQuery);

  const totalBookCount = rows.reduce((acc, curr) => acc + curr.count, 0);
  const statuses = [...fillBookStatuses(rows), { status: 'all', count: totalBookCount }];
  const count = Object.fromEntries(statuses.map(({ status, count }) => [status, count]));

  return {
    count,
    pages_read: rows[0].pages_read,
    score_average: rows[0].average,
  };
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

type MovieDataV2 = {
  count: Record<string, number>;
  watch_time: number;
  score_average: number;
};

const fillMovieStatuses = (rows: StatusRow[]): StatusRow[] => {
  return movieStatuses.map((status) => {
    const row = rows.find((row) => row.status === status);
    return { status, count: row?.count || 0 };
  });
};

const getMovieDataV2 = async (username: string): Promise<MovieDataV2> => {
  const movieDataQuery: QueryConfig = {
    text: `SELECT * FROM
            (SELECT uml.status, coalesce(count(*), 0) AS count
              FROM movies m
              LEFT JOIN user_movie_list uml ON m.movie_id=uml.movie_id
              WHERE m.submitter = $1
              GROUP BY uml.status) AS count,
            (SELECT coalesce(sum(m.duration) / 60, 0) as watch_time, coalesce(round(avg(uml.score), 1), 0) AS average
              FROM movies m
              INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
              WHERE submitter = $1 AND uml.status != 'planned') watch_time_and_avg_score`,
    values: [username],
  };

  const { rows } = await query(movieDataQuery);

  const totalMovieCount = rows.reduce((acc, curr) => acc + curr.count, 0);
  const statuses: StatusRow[] = [
    ...fillMovieStatuses(rows),
    { status: 'all', count: totalMovieCount },
  ];
  const count = Object.fromEntries(statuses.map(({ status, count }) => [status, count]));

  return {
    count,
    watch_time: rows[0].watch_time,
    score_average: rows[0].average,
  };
};

type ItemScoreRow = {
  score: number;
  count: number;
};

const getBookScores = async (username: string): Promise<ItemScoreRow[]> => {
  const scoreQuery: QueryConfig = {
    text: `SELECT ubl.score, count(ubl.score)
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE submitter = $1 AND ubl.status != 'planned'
           GROUP BY ubl.score;`,
    values: [username],
  };
  const { rows }: { rows: ItemScoreRow[] } = await query(scoreQuery);
  return await fillAndSortResponse(rows);
};

const getMovieScores = async (username: string): Promise<ItemScoreRow[]> => {
  const scoreQuery: QueryConfig = {
    text: `SELECT uml.score, count(uml.score)
           FROM movies m
                    INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
           WHERE submitter = $1 AND uml.status != 'planned'
           GROUP BY uml.score;`,
    values: [username],
  };

  const { rows }: { rows: ItemScoreRow[] } = await query(scoreQuery);
  return await fillAndSortResponse(rows);
};

type ProfileData = {
  userInfo: UserInfo;
  bookData: BookData;
  movieData: MovieData;
  bookScores: ItemScoreRow[];
  movieScores: ItemScoreRow[];
};

const getProfileData = async (username: string): Promise<ProfileData> => {
  const [userInfo, bookData, movieData, bookScores, movieScores] = await Promise.all([
    getUserInfo(username),
    getBookData(username),
    getMovieData(username),
    getBookScores(username),
    getMovieScores(username),
  ]);
  return {
    userInfo,
    bookData,
    movieData,
    bookScores,
    movieScores,
  };
};

type ProfileDataV2 = {
  userInfo: UserInfo;
  bookData: BookDataV2;
  movieData: MovieDataV2;
  bookScores: ItemScoreRow[];
  movieScores: ItemScoreRow[];
};

const getProfileDataV2 = async (username: string): Promise<ProfileDataV2> => {
  const [userInfo, bookData, movieData, bookScores, movieScores] = await Promise.all([
    getUserInfo(username),
    getBookDataV2(username),
    getMovieDataV2(username),
    getBookScores(username),
    getMovieScores(username),
  ]);
  return {
    userInfo,
    bookData,
    movieData,
    bookScores,
    movieScores,
  };
};

export { getProfileData, getProfileDataV2, ItemScoreRow };
