import { NextFunction, Request, Response } from 'express';
import { QueryConfig } from 'pg';
import { query } from '../db/config';
import { getUserByUsername } from '../db/users';
import { ErrorWithStatus } from '../util/errorhandler';
import * as fs from 'fs/promises';
import * as bcrypt from 'bcrypt';
import { success } from '../util/response';
import Logger from '../util/logger';
import { fillAndSortResponse, getTruncatedTitles } from '../util/profile';
import { registerFont, createCanvas } from 'canvas';
import { getTop10Books } from '../db/books';
import { getTop10Movies } from '../db/movies';
import { generateShareId, getFontPath, getShareItemPath } from '../util/share';
import { postShare } from '../db/share';
import { DateTime } from 'luxon';

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

  const bookCount = await query(countQuery);
  const pagesRead = await query(pagesReadQuery);
  const avgBookScore = await query(avgScoreQuery);

  const response: BookData = {
    count: bookCount.rows[0].count,
    pages_read: pagesRead.rows[0].pages_read,
    score_average: avgBookScore.rows[0].average,
  };
  return response;
};

type MovieData = {
  count: number;
  watch_time: number;
  score_average: number;
};

const getMovieData = async (username: string): Promise<MovieData> => {
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

  const movieCount = await query(countQuery);
  const watchTime = await query(watchTimeQuery);
  const avgMovieScore = await query(avgScoreQuery);

  const response: MovieData = {
    count: movieCount.rows[0].count,
    watch_time: watchTime.rows[0].watch_time,
    score_average: avgMovieScore.rows[0].average,
  };
  return response;
};

type ItemScore = {
  score: number;
  count: string;
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

const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;

  try {
    const { user_id, registration_date } = await getUserInfo(username);
    const book = await getBookData(username);
    const movie = await getMovieData(username);
    const bookScoreDistribution = await getBookScores(username);
    const movieScoreDistribution = await getMovieScores(username);

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
    const shareImagePath = getShareItemPath(username);
    await fs.rm(shareImagePath, { force: true });

    res
      .status(200)
      .json(success([{ name: 'account_deleted', message: 'Account successfully deleted' }]));
  } catch (error) {
    next(new ErrorWithStatus(422, 'profile_error', "Couldn't delete account"));
  }
};

const generateShareImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = res.locals;
    const bookTitles = getTruncatedTitles(await getTop10Books(username));
    const movieTitles = getTruncatedTitles(await getTop10Movies(username));

    if (bookTitles.length === 0 && movieTitles.length === 0) {
      next(new ErrorWithStatus(422, 'profile_error', 'Not enough items for image creation'));
      return;
    }

    const canvasWidth = 700;
    const canvasHeight = 500;
    const canvasLeftPadding = 20;
    const dividerHeight = 70;
    const listItemPadding = 32;
    const listColumnPadding = 120;
    const listColumnPaddingTop = 20;
    const listColumnTitleY = dividerHeight + listColumnPaddingTop;
    const listColumnContentY = listColumnTitleY + 45;

    const backgroundColor = '#191b21';
    const dividerColor = '#323642';
    const accentColor = '#64b5f6';
    const headerTextColor = '#eee';
    const bodyTextColor = '#ccc';

    const listHeaderFont = '700 18pt Roboto';
    const listItemFont = '700 14pt Roboto';

    registerFont(getFontPath('pacifico.ttf'), { family: 'Pacifico' });
    registerFont(getFontPath('roboto-regular.ttf'), { family: 'Roboto', weight: '400' });
    registerFont(getFontPath('roboto-bold.ttf'), { family: 'Roboto', weight: '700' });

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.textBaseline = 'top';

    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Image borders
    ctx.fillStyle = accentColor;
    const thickness = 2;
    ctx.fillRect(0, 0, canvasWidth, thickness); // Top
    ctx.fillRect(0, 0, thickness, canvasHeight); // Left
    ctx.fillRect(0, canvasHeight - thickness, canvasWidth, thickness); // Bottom
    ctx.fillRect(canvasWidth - thickness, 0, thickness, canvasHeight); // Right

    // Top-left logo
    ctx.fillStyle = headerTextColor;
    ctx.font = '40pt Pacifico';
    ctx.fillText('e', 12, -34);

    // Bottom-right date
    ctx.fillStyle = '#b2b2b2';
    ctx.font = '10pt Roboto';
    const date = DateTime.now().toISODate();
    const dateWidth = ctx.measureText(date).width;
    const dateX = canvasWidth - dateWidth - 20;
    const dateY = canvasHeight - 30;
    ctx.fillText(date, dateX, dateY);

    // Username
    ctx.fillStyle = headerTextColor;
    ctx.font = 'bold 24pt Roboto';
    const usernameWidth = ctx.measureText(username).width;
    const usernameX = canvasWidth / 2 - usernameWidth / 2;
    ctx.fillText(username, usernameX, 15);

    // Divider
    ctx.fillStyle = dividerColor;
    ctx.fillRect(70, dividerHeight, canvasWidth - 140, 2);

    // Book list
    const bookListX = 70;
    let maxTitleWidth = bookListX; // Minimum so that columns don't overlap

    if (bookTitles.length > 0) {
      let bookListY = listColumnContentY;

      ctx.fillStyle = headerTextColor;
      ctx.font = listHeaderFont;
      ctx.fillText('Top books', bookListX, listColumnTitleY);

      ctx.fillStyle = bodyTextColor;
      ctx.font = listItemFont;
      bookTitles.forEach((title, i) => {
        ctx.fillText(`${i + 1}. ${title}`, bookListX, bookListY);
        bookListY += listItemPadding;

        const titleWidth = ctx.measureText(title).width;
        if (titleWidth > maxTitleWidth) {
          maxTitleWidth = titleWidth;
        }
      });
    }

    // Movie list
    if (movieTitles.length > 0) {
      let movieListX = maxTitleWidth;

      if (bookTitles.length > 0) {
        movieListX =
          listColumnPadding > movieListX
            ? maxTitleWidth + listColumnPadding + canvasLeftPadding
            : movieListX + listColumnPadding;
      }

      let movieListY = listColumnContentY;

      ctx.fillStyle = headerTextColor;
      ctx.font = listHeaderFont;
      ctx.fillText('Top movies', movieListX, listColumnTitleY);

      ctx.fillStyle = bodyTextColor;
      ctx.font = listItemFont;
      movieTitles.forEach((title, i) => {
        ctx.fillText(`${i + 1}. ${title}`, movieListX, movieListY);
        movieListY += listItemPadding;
      });
    }

    const imageBuffer = canvas.toBuffer('image/png');
    const shareImagePath = getShareItemPath(username);
    const shareId = generateShareId();

    await postShare(shareId, username);
    await fs.writeFile(shareImagePath, imageBuffer);

    res.status(200).json(success([{ share_id: shareId }]));
  } catch (error) {
    Logger.error(error);
    next(new ErrorWithStatus(500, 'profile_error', "Couldn't share profile"));
  }
};

export { getProfile, generateShareImage, deleteAccount, ItemScore };
