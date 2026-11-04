import type { ITask } from 'pg-promise';
import { fillBookStatuses, fillMovieStatuses, type StatusCountRow } from '../util/status.ts';

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

type BookDataV2 = Omit<BookData, 'count'> & { count: Record<string, number> };

type MovieData = {
  count: number;
  watch_time: number;
  score_average: number;
};

type MovieDataV2 = Omit<MovieData, 'count'> & { count: Record<string, number> };

export type ItemScoreRow = {
  score: number;
  count: number;
};

type StatsRow = {
  status: string | null;
  score: number | null;
  count: number;
  completed_total: number;
  average: number;
  is_status_summary: boolean;
  is_score_summary: boolean;
};

const summarizeStats = (
  rows: StatsRow[],
  fillStatuses: (rows: StatusCountRow[]) => StatusCountRow[],
) => {
  const total = rows.find((row) => !row.is_status_summary && !row.is_score_summary)!;
  const statuses = fillStatuses(
    rows
      .filter((row) => row.is_status_summary && row.status !== null)
      .map((row) => ({
        status: row.status!,
        count: row.count,
      })),
  );
  const count = Object.fromEntries([
    ...statuses.map(({ status, count }) => [status, count]),
    ['all', total.count],
  ]);
  const scoreCounts = new Map(
    rows
      .filter((row) => row.is_score_summary && row.score !== null && row.score > 0)
      .map((row) => [row.score, row.count]),
  );
  const scores = Array.from({ length: 10 }, (_, index) => ({
    score: index + 1,
    count: scoreCounts.get(index + 1) ?? 0,
  }));
  return { total, count, scores };
};

// Grouping sets produce status counts, score distributions, and totals from one join.
const getBookStats = async (t: ITask<unknown>, username: string) => {
  const rows = await t.any<StatsRow>(
    `SELECT ubl.status, ubl.score, count(*) AS count,
            COALESCE(sum(b.pages) FILTER (WHERE ubl.status = 'completed'), 0) AS completed_total,
            COALESCE(round(avg(ubl.score) FILTER (WHERE ubl.score > 0), 1), 0) AS average,
            GROUPING(ubl.status) = 0 AS is_status_summary,
            GROUPING(ubl.score) = 0 AS is_score_summary
     FROM books b
     INNER JOIN user_book_list ubl USING (book_id)
     WHERE b.submitter = $1
     GROUP BY GROUPING SETS ((ubl.status), (ubl.score), ())`,
    [username],
  );
  return summarizeStats(rows, fillBookStatuses);
};

const getMovieStats = async (t: ITask<unknown>, username: string) => {
  const rows = await t.any<StatsRow>(
    `SELECT uml.status, uml.score, count(*) AS count,
            COALESCE(sum(m.duration) FILTER (WHERE uml.status = 'completed') / 60, 0) AS completed_total,
            COALESCE(round(avg(uml.score) FILTER (WHERE uml.score > 0), 1), 0) AS average,
            GROUPING(uml.status) = 0 AS is_status_summary,
            GROUPING(uml.score) = 0 AS is_score_summary
     FROM movies m
     INNER JOIN user_movie_list uml USING (movie_id)
     WHERE m.submitter = $1
     GROUP BY GROUPING SETS ((uml.status), (uml.score), ())`,
    [username],
  );
  return summarizeStats(rows, fillMovieStatuses);
};

type ProfileData = {
  userInfo: UserInfo;
  bookData: BookData;
  movieData: MovieData;
  bookScores: ItemScoreRow[];
  movieScores: ItemScoreRow[];
};

type ProfileDataV2 = Omit<ProfileData, 'bookData' | 'movieData'> & {
  bookData: BookDataV2;
  movieData: MovieDataV2;
};

export const getProfileDataV2 = async (
  t: ITask<unknown>,
  username: string,
): Promise<ProfileDataV2> => {
  const userInfo = await getUserInfo(t, username);
  const books = await getBookStats(t, username);
  const movies = await getMovieStats(t, username);
  return {
    userInfo,
    bookData: {
      count: books.count,
      pages_read: books.total.completed_total,
      score_average: books.total.average,
    },
    movieData: {
      count: movies.count,
      watch_time: movies.total.completed_total,
      score_average: movies.total.average,
    },
    bookScores: books.scores,
    movieScores: movies.scores,
  };
};

export const getProfileData = async (t: ITask<unknown>, username: string): Promise<ProfileData> => {
  const userInfo = await getUserInfo(t, username);
  const books = await getBookStats(t, username);
  const movies = await getMovieStats(t, username);
  return {
    userInfo,
    bookData: {
      count: books.total.count,
      pages_read: books.total.completed_total,
      score_average: books.total.average,
    },
    movieData: {
      count: movies.total.count,
      watch_time: movies.total.completed_total,
      score_average: movies.total.average,
    },
    bookScores: books.scores,
    movieScores: movies.scores,
  };
};
