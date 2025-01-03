import { fillAndSortResponse } from '../util/profile';
import { ITask } from 'pg-promise';
import { fillBookStatuses, fillMovieStatuses, StatusCountRow } from '../util/status';

type UserInfo = {
  user_id: string;
  username: string;
  email: string | null;
  email_verified_on: string | null;
  totp_enabled_on: string | null;
  last_login_on: string | null;
  profile_picture_path: string | null;
  registration_date: string;
};

const getUserInfo = async (t: ITask<unknown>, username: string): Promise<UserInfo> => {
  return await t.one({
    text: `SELECT user_id, username, email, email_verified_on, totp_enabled_on, last_login_on, profile_picture_path, created_on as registration_date
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

const getBookData = async (t: ITask<unknown>, username: string): Promise<BookData> => {
  const pagesAndAvgScore = await t.one({
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

type BookDataV2 = {
  count: Record<string, number>;
  pages_read: number;
  score_average: number;
};

const getBookDataV2 = async (t: ITask<unknown>, username: string): Promise<BookDataV2> => {
  const rows = await t.any({
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

const getMovieData = async (t: ITask<unknown>, username: string): Promise<MovieData> => {
  const movieData = await t.any({
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
  const statuses: StatusCountRow[] = [
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

export type ItemScoreRow = {
  score: number;
  count: number;
};

const getBookScores = async (t: ITask<unknown>, username: string): Promise<ItemScoreRow[]> => {
  const rows = await t.any<ItemScoreRow>({
    text: `SELECT ubl.score, count(ubl.score)
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE b.submitter = $1 AND ubl.score > 0
           GROUP BY ubl.score;`,
    values: [username],
  });
  return await fillAndSortResponse(rows);
};

const getMovieScores = async (t: ITask<unknown>, username: string): Promise<ItemScoreRow[]> => {
  const rows = await t.any<ItemScoreRow>({
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

export const getProfileData = async (t: ITask<unknown>, username: string): Promise<ProfileData> => {
  const [userInfo, bookData, movieData, bookScores, movieScores] = await Promise.all([
    getUserInfo(t, username),
    getBookData(t, username),
    getMovieData(t, username),
    getBookScores(t, username),
    getMovieScores(t, username),
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

export const getProfileDataV2 = async (
  t: ITask<unknown>,
  username: string,
): Promise<ProfileDataV2> => {
  const [userInfo, bookData, movieData, bookScores, movieScores] = await Promise.all([
    getUserInfo(t, username),
    getBookDataV2(t, username),
    getMovieDataV2(t, username),
    getBookScores(t, username),
    getMovieScores(t, username),
  ]);
  return {
    userInfo,
    bookData,
    movieData,
    bookScores,
    movieScores,
  };
};
