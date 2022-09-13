import { NextFunction, Request, Response } from 'express';
import { QueryConfig } from 'pg';
import { query } from '../db/config';
import { getUserByUsername } from '../db/users';
import { ErrorWithStatus } from '../util/errorhandler';
import * as bcrypt from 'bcrypt';
import { success } from '../util/response';
import Logger from '../util/logger';
import { fillAndSortResponse } from '../util/profile';

const getUserInfo = async (username: string, next: NextFunction) => {
  const usernameQuery: QueryConfig = {
    text: `SELECT user_id, created_on as registration_date
           FROM users
           WHERE username = $1`,
    values: [username],
  };
  try {
    const { rows } = await query(usernameQuery);
    return rows[0];
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching user data'));
  }
};

type BookData = {
  count: number;
  pages_read: number;
  score_average: number;
};

const getBookData = async (username: string, next: NextFunction) => {
  const countQuery: QueryConfig = {
    text: `SELECT count(*)
           FROM books
           WHERE submitter = $1`,
    values: [username],
  };

  const pagesReadQuery: QueryConfig = {
    text: `SELECT coalesce(sum(b.pages), 0) as pages_read
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE submitter = $1 AND ubl.status != 'planned'`,
    values: [username],
  };

  const avgScoreQuery: QueryConfig = {
    text: `SELECT coalesce(round(avg(ubl.score), 1), 0) AS average
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE submitter = $1 AND ubl.status != 'planned'`,
    values: [username],
  };

  try {
    const bookCount = await query(countQuery);
    const pagesRead = await query(pagesReadQuery);
    const avgBookScore = await query(avgScoreQuery);

    const response: BookData = {
      count: bookCount.rows[0].count,
      pages_read: pagesRead.rows[0].pages_read,
      score_average: avgBookScore.rows[0].average,
    };
    return response;
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching book data'));
  }
};

type MovieData = {
  count: number;
  watch_time: number;
  score_average: number;
};

const getMovieData = async (username: string, next: NextFunction) => {
  const countQuery: QueryConfig = {
    text: `SELECT count(*)
           FROM movies
           WHERE submitter = $1`,
    values: [username],
  };

  const watchTimeQuery: QueryConfig = {
    text: `SELECT coalesce(sum(m.duration) / 60, 0) as watch_time
           FROM movies m INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
           WHERE submitter = $1 AND uml.status != 'planned'`,
    values: [username],
  };

  const avgScoreQuery: QueryConfig = {
    text: `SELECT coalesce(round(avg(uml.score), 1), 0) AS average
           FROM movies m
                    INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
           WHERE submitter = $1 AND uml.status != 'planned'`,
    values: [username],
  };

  try {
    const movieCount = await query(countQuery);
    const watchTime = await query(watchTimeQuery);
    const avgMovieScore = await query(avgScoreQuery);

    const response: MovieData = {
      count: movieCount.rows[0].count,
      watch_time: watchTime.rows[0].watch_time,
      score_average: avgMovieScore.rows[0].average,
    };
    return response;
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching movie data'));
  }
};

type ItemScore = {
  score: number;
  count: string;
};

const getBookScores = async (username: string, next: NextFunction) => {
  const scoreQuery: QueryConfig = {
    text: `SELECT ubl.score, count(ubl.score)
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE submitter = $1 AND ubl.status != 'planned'
           GROUP BY ubl.score;`,
    values: [username],
  };

  try {
    const { rows }: { rows: ItemScore[] } = await query(scoreQuery);
    return await fillAndSortResponse(rows);
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching book scores'));
  }
};

const getMovieScores = async (username: string, next: NextFunction) => {
  const scoreQuery: QueryConfig = {
    text: `SELECT uml.score, count(uml.score)
           FROM movies m
                    INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
           WHERE submitter = $1 AND uml.status != 'planned'
           GROUP BY uml.score;`,
    values: [username],
  };

  try {
    const { rows }: { rows: ItemScore[] } = await query(scoreQuery);
    return await fillAndSortResponse(rows);
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching movie scores'));
  }
};

const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const { user_id, registration_date } = await getUserInfo(username, next);
    const book = await getBookData(username, next);
    const movie = await getMovieData(username, next);
    const bookScoreDistribution = await getBookScores(username, next);
    const movieScoreDistribution = await getMovieScores(username, next);

    res.status(200).json({
      user_id,
      username,
      registration_date,
      stats: {
        book: {
          ...book,
          score_distribution: bookScoreDistribution,
        },
        movie: {
          ...movie,
          score_distribution: movieScoreDistribution,
        },
      },
    });
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'profile_error', "Couldn't fetch profile"));
  }
};

const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const { password } = req.body;

  if (!password || password === undefined) {
    next(new ErrorWithStatus(422, 'profile_error', 'Send user password in the request body'));
    return;
  }

  const user = await getUserByUsername(username);
  if (user === undefined) {
    next(new ErrorWithStatus(422, 'profile_error', "Couldn't find user"));
    return;
  }

  const result = await bcrypt.compare(password, user.password);
  if (!result) {
    next(new ErrorWithStatus(422, 'profile_error', 'Incorrect password'));
    return;
  }

  try {
    const deleteAccountQuery: QueryConfig = {
      text: `DELETE FROM users WHERE username = $1`,
      values: [username],
    };
    await query(deleteAccountQuery);
    res
      .status(200)
      .json(success([{ name: 'account_deleted', message: 'Account successfully deleted' }]));
  } catch (error) {
    next(new ErrorWithStatus(422, 'profile_error', "Couldn't delete account."));
  }
};

export { getProfile, deleteAccount, ItemScore };
