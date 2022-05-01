import { NextFunction, Request, Response } from 'express';
import { QueryConfig } from 'pg';
import { query } from '../db/config';
import { ErrorWithStatus } from '../util/errorhandler';

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

const getBookData = async (username: string, next: NextFunction) => {
  const bookQuery: QueryConfig = {
    text: `SELECT count(book_id), coalesce(sum(pages), 0) as pages_read
           FROM books
           WHERE submitter = $1`,
    values: [username],
  };
  try {
    const { rows } = await query(bookQuery);
    return rows[0];
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching book data'));
  }
};

const getMovieData = async (username: string, next: NextFunction) => {
  const movieQuery: QueryConfig = {
    text: `SELECT count(movie_id), coalesce(sum(duration) / 60, 0) as watch_time
           FROM movies
           WHERE submitter = $1`,
    values: [username],
  };
  try {
    const { rows } = await query(movieQuery);
    return rows[0];
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching movie data'));
  }
};

const getBookScores = async (username: string, next: NextFunction) => {
  const scoreQuery: QueryConfig = {
    text: `SELECT ubl.score, count(ubl.score)
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE submitter = $1
           GROUP BY ubl.score;`,
    values: [username],
  };

  try {
    const { rows } = await query(scoreQuery);
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
           WHERE submitter = $1
           GROUP BY uml.score;`,
    values: [username],
  };

  try {
    const { rows } = await query(scoreQuery);
    return await fillAndSortResponse(rows);
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching movie scores'));
  }
};

const getBookAvgScore = async (username: string, next: NextFunction) => {
  const avgScoreQuery: QueryConfig = {
    text: `SELECT coalesce(round(avg(ubl.score), 1), 0) AS average
           FROM books b
                    INNER JOIN user_book_list ubl on b.book_id = ubl.book_id
           WHERE submitter = $1;`,
    values: [username],
  };

  try {
    const { rows } = await query(avgScoreQuery);
    return rows[0].average;
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching book average scores'));
  }
};

const getMovieAvgScore = async (username: string, next: NextFunction) => {
  const avgScoreQuery: QueryConfig = {
    text: `SELECT coalesce(round(avg(uml.score), 1), 0) AS average
           FROM movies m
                    INNER JOIN user_movie_list uml on m.movie_id = uml.movie_id
           WHERE submitter = $1;`,
    values: [username],
  };

  try {
    const { rows } = await query(avgScoreQuery);
    return rows[0].average;
  } catch (e) {
    next(new ErrorWithStatus(500, 'profile_error', 'Error fetching movie average scores'));
  }
};

type ItemScore = {
  score: number;
  count: string;
};

/**
 * Fills array gaps so that there are ItemScore objects which have score
 * from 0 to 10. Lastly it sorts the array by the score property.
 * @example
 * [
 *    { score: 0, count: 6 },
 *    { score: 1, count: 4 },
 *    { score: 2, count: 1 },
 *    { score: 3, count: 12 }
 *    ...
 * ]
 * @param array Initial book/movie score array
 */
const fillAndSortResponse = async (array: ItemScore[]) => {
  return new Promise<Array<ItemScore>>((resolve) => {
    const resultArray: ItemScore[] = [];
    const foundNumbers: number[] = [];

    array.forEach((item) => {
      resultArray.push(item);
      foundNumbers.push(item.score);
    });

    for (let i = 0; i <= 10; i++) {
      if (!foundNumbers.includes(i)) {
        resultArray.push({ score: i, count: '0' });
      }
    }

    resultArray.sort((a, b) => a.score - b.score);
    resolve(resultArray);
  });
};

const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const { user_id, registration_date } = await getUserInfo(username, next);
  const book = await getBookData(username, next);
  const movie = await getMovieData(username, next);
  const bookScoreDistribution = await getBookScores(username, next);
  const movieScoreDistribution = await getMovieScores(username, next);
  const bookAverageScore = await getBookAvgScore(username, next);
  const movieAverageScore = await getMovieAvgScore(username, next);

  res.status(200).json({
    user_id,
    username,
    registration_date,
    stats: {
      book: {
        ...book,
        score_average: bookAverageScore,
        score_distribution: bookScoreDistribution,
      },
      movie: {
        ...movie,
        score_average: movieAverageScore,
        score_distribution: movieScoreDistribution,
      },
    },
  });
};

export { getProfile };
