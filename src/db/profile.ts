import { fillAndSortResponse } from '../util/profile';
import { movieStatuses } from './model/moviestatus';
import { bookStatuses } from './model/bookstatus';
import { ITask } from 'pg-promise';

type UserInfo = {
  user_id: string;
  email: string | null;
  email_verified_on: string | null;
  totp_enabled_on: string | null;
  registration_date: string;
};

const getUserInfo = async (client: ITask<unknown>, username: string): Promise<UserInfo> => {
  return await client.one({
    text: `SELECT user_id, email, email_verified_on, totp_enabled_on, created_on as registration_date
           FROM users
           WHERE username = $1`,
    values: [username],
  });
};

type BookData = {
  count: number;
  pages_read: number;
  score_average: number;
};

const getBookData = async (client: ITask<unknown>, username: string): Promise<BookData> => {
  const pagesAndAvgScore = await client.one({
    text: `SELECT * FROM
            (SELECT count(*) FROM books WHERE submitter = $1) count,
            (SELECT coalesce(sum(b.pages), 0) as pages_read, coalesce(round(avg(ubl.score), 1), 0) AS average
            FROM books b
            INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
            WHERE submitter = $1 AND ubl.score > 0) pages_and_avg_score`,
    values: [username],
  });
  const response: BookData = {
    count: pagesAndAvgScore.count,
    pages_read: pagesAndAvgScore.pages_read,
    score_average: pagesAndAvgScore.average,
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

const getBookDataV2 = async (client: ITask<unknown>, username: string): Promise<BookDataV2> => {
  const rows = await client.any({
    text: `SELECT * FROM
            (SELECT ubl.status, COALESCE(count(*), 0) AS count
              FROM books b
              INNER JOIN user_book_list ubl ON b.book_id=ubl.book_id
              WHERE b.submitter = $1
              GROUP BY ubl.status) count,
            (SELECT COALESCE(sum(b.pages), 0) AS pages_read, COALESCE(round(avg(ubl.score), 1), 0) AS average
              FROM books b
              INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
              WHERE submitter = $1 AND ubl.score > 0) pages_and_avg_score`,
    values: [username],
  });

  const totalBookCount = rows.reduce((acc, curr) => acc + curr.count, 0);
  const statuses = [...fillBookStatuses(rows), { status: 'all', count: totalBookCount }];
  const count = Object.fromEntries(statuses.map(({ status, count }) => [status, count]));

  return {
    count,
    pages_read: rows?.[0]?.pages_read || 0,
    score_average: rows?.[0]?.average || 0,
  };
};

type MovieData = {
  count: number;
  watch_time: number;
  score_average: number;
};

const getMovieData = async (client: ITask<unknown>, username: string): Promise<MovieData> => {
  const movieData = await client.any({
    text: `SELECT * FROM
            (SELECT count(*) FROM movies WHERE submitter = $1) count,
            (SELECT coalesce(sum(m.duration) / 60, 0) as watch_time, coalesce(round(avg(uml.score), 1), 0) AS average
            FROM movies m INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
            WHERE submitter = $1 AND uml.score > 0) watch_time_and_avg_score`,
    values: [username],
  });
  return {
    count: movieData[0].count,
    watch_time: movieData[0].watch_time,
    score_average: movieData[0].average,
  };
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

const getMovieDataV2 = async (client: ITask<unknown>, username: string): Promise<MovieDataV2> => {
  const rows = await client.any({
    text: `SELECT * FROM
            (SELECT uml.status, COALESCE(count(*), 0) AS count
              FROM movies m
              LEFT JOIN user_movie_list uml ON m.movie_id=uml.movie_id
              WHERE m.submitter = $1
              GROUP BY uml.status) count,
            (SELECT COALESCE(sum(m.duration) / 60, 0) AS watch_time, COALESCE(round(avg(uml.score), 1), 0) AS average
              FROM movies m
              INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
              WHERE submitter = $1 AND uml.score > 0) watch_time_and_avg_score`,
    values: [username],
  });

  const totalMovieCount = rows.reduce((acc, curr) => acc + curr.count, 0);
  const statuses: StatusRow[] = [
    ...fillMovieStatuses(rows),
    { status: 'all', count: totalMovieCount },
  ];
  const count = Object.fromEntries(statuses.map(({ status, count }) => [status, count]));

  return {
    count,
    watch_time: rows?.[0]?.watch_time || 0,
    score_average: rows?.[0]?.average || 0,
  };
};

type ItemScoreRow = {
  score: number;
  count: number;
};

const getBookScores = async (client: ITask<unknown>, username: string): Promise<ItemScoreRow[]> => {
  const rows = await client.any({
    text: `SELECT ubl.score, count(ubl.score)
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE b.submitter = $1 AND ubl.score > 0
           GROUP BY ubl.score;`,
    values: [username],
  });
  return await fillAndSortResponse(rows);
};

const getMovieScores = async (
  client: ITask<unknown>,
  username: string,
): Promise<ItemScoreRow[]> => {
  const rows = await client.any({
    text: `SELECT uml.score, count(uml.score)
           FROM movies m
                    INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
           WHERE m.submitter = $1 AND uml.score > 0
           GROUP BY uml.score;`,
    values: [username],
  });
  return await fillAndSortResponse(rows);
};

type ProfileData = {
  userInfo: UserInfo;
  bookData: BookData;
  movieData: MovieData;
  bookScores: ItemScoreRow[];
  movieScores: ItemScoreRow[];
};

const getProfileData = async (client: ITask<unknown>, username: string): Promise<ProfileData> => {
  const [userInfo, bookData, movieData, bookScores, movieScores] = await Promise.all([
    getUserInfo(client, username),
    getBookData(client, username),
    getMovieData(client, username),
    getBookScores(client, username),
    getMovieScores(client, username),
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

const getProfileDataV2 = async (
  client: ITask<unknown>,
  username: string,
): Promise<ProfileDataV2> => {
  const [userInfo, bookData, movieData, bookScores, movieScores] = await Promise.all([
    getUserInfo(client, username),
    getBookDataV2(client, username),
    getMovieDataV2(client, username),
    getBookScores(client, username),
    getMovieScores(client, username),
  ]);
  return {
    userInfo,
    bookData,
    movieData,
    bookScores,
    movieScores,
  };
};

export { getProfileData, getProfileDataV2, ItemScoreRow, BookDataV2, MovieDataV2 };
