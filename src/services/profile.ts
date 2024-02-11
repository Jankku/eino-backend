import { NextFunction, Request, Response } from 'express';
import { db, pgp } from '../db/config';
import { isPasswordCorrect } from '../db/users';
import { ErrorWithStatus } from '../util/errorhandler';
import * as fs from 'node:fs/promises';
import { success } from '../util/response';
import Logger from '../util/logger';
import { registerFont, createCanvas } from 'canvas';
import { getAllBooks, getTop10BookTitles } from '../db/books';
import { getAllMovies, getTop10MovieTitles } from '../db/movies';
import { generateShareId, getFontPath, getShareItemPath } from '../util/share';
import { getSharesByUsername, postShare } from '../db/share';
import { DateTime } from 'luxon';
import { getProfileData, getProfileDataV2 } from '../db/profile';
import { importProfileSchema } from '../routes/profile/schema';
import {
  booksCs,
  booksListCs,
  calculateBookHash,
  calculateMovieHash,
  moviesCs,
  moviesListCs,
} from '../util/profile';

const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  try {
    const data = await db.task(async (t) => await getProfileData(t, username));

    res.status(200).json({
      user_id: data.userInfo.user_id,
      username: username,
      registration_date: data.userInfo.registration_date,
      stats: {
        book: {
          ...data.bookData,
          score_distribution: data.bookScores,
        },
        movie: {
          ...data.movieData,
          score_distribution: data.movieScores,
        },
      },
    });
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'profile_error', "Couldn't fetch profile"));
  }
};

const getProfileV2 = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  try {
    const data = await db.task(async (t) => await getProfileDataV2(t, username));
    res.status(200).json({
      user_id: data.userInfo.user_id,
      username: username,
      registration_date: data.userInfo.registration_date,
      stats: {
        book: {
          ...data.bookData,
          score_distribution: data.bookScores,
        },
        movie: {
          ...data.movieData,
          score_distribution: data.movieScores,
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

  const isCorrect = await isPasswordCorrect(username, password);
  if (!isCorrect) {
    next(new ErrorWithStatus(422, 'profile_error', 'Incorrect password'));
    return;
  }

  try {
    await db.none({
      text: `DELETE FROM users WHERE username = $1`,
      values: [username],
    });
    const shareImagePath = getShareItemPath(username);
    await fs.rm(shareImagePath, { force: true });

    res
      .status(200)
      .json(success([{ name: 'account_deleted', message: 'Account successfully deleted' }]));
  } catch {
    next(new ErrorWithStatus(422, 'profile_error', "Couldn't delete account"));
  }
};

const generateShareImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = res.locals;
    const bookTitles = await getTop10BookTitles(username);
    const movieTitles = await getTop10MovieTitles(username);

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
    const date = String(DateTime.now().toISODate());
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
      for (const [i, title] of bookTitles.entries()) {
        ctx.fillText(`${i + 1}. ${title}`, bookListX, bookListY);
        bookListY += listItemPadding;

        const titleWidth = ctx.measureText(title).width;
        if (titleWidth > maxTitleWidth) {
          maxTitleWidth = titleWidth;
        }
      }
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
      for (const [i, title] of movieTitles.entries()) {
        ctx.fillText(`${i + 1}. ${title}`, movieListX, movieListY);
        movieListY += listItemPadding;
      }
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

const exportUserData = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = res.locals;
  const { password } = req.body;

  if (!password || password === undefined) {
    next(
      new ErrorWithStatus(422, 'profile_export_error', 'Send user password in the request body'),
    );
    return;
  }

  const isCorrect = await isPasswordCorrect(username, password);
  if (!isCorrect) {
    next(new ErrorWithStatus(422, 'profile_export_error', 'Incorrect password'));
    return;
  }

  try {
    const [books, movies, profile, shares] = await db.task('export-user-data', async (t) => {
      return Promise.all([
        getAllBooks(username, t),
        getAllMovies(username, t),
        getProfileDataV2(t, username),
        getSharesByUsername(username, t),
      ]);
    });

    res.status(200).json({
      version: 2,
      profile: {
        user_id: profile.userInfo.user_id,
        username: username,
        registration_date: profile.userInfo.registration_date,
        stats: {
          book: {
            ...profile.bookData,
            score_distribution: profile.bookScores,
          },
          movie: {
            ...profile.movieData,
            score_distribution: profile.movieScores,
          },
        },
      },
      books,
      movies,
      shares,
    });
  } catch (error) {
    Logger.error(error);
    next(new ErrorWithStatus(500, 'profile_error', "Couldn't export user data"));
  }
};

const importUserData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = res.locals;
    const { body } = importProfileSchema.parse(req);

    const bookHashMap = Object.fromEntries(
      body.books.map((book) => [calculateBookHash(book), book]),
    );
    const movieHashMap = Object.fromEntries(
      body.movies.map((movie) => [calculateMovieHash(movie), movie]),
    );

    const mapBooks = body.books.map((book) => ({ ...book, submitter: username }));
    const mapMovies = body.movies.map((movie) => ({ ...movie, submitter: username }));

    await db.tx('import-profile', async (t) => {
      // Insert books to books table
      const newBooks = await t.many(pgp.helpers.insert(mapBooks, booksCs) + ' RETURNING *');

      // Map inserted books to be compatible with user_book_list table
      const bookListItems = newBooks.map((book) => ({
        ...bookHashMap[calculateBookHash(book)],
        book_id: book.book_id,
        username,
      }));

      // Insert mapped books to user_book_list table
      const insertBookList = pgp.helpers.insert(bookListItems, booksListCs);
      await t.none(insertBookList);

      // Insert movies to movies table
      const newMovies = await t.many(pgp.helpers.insert(mapMovies, moviesCs) + ' RETURNING *');

      // Map inserted movies to be compatible with user_movie_list table
      const movieListItems = newMovies.map((movie) => ({
        ...movieHashMap[calculateMovieHash(movie)],
        movie_id: movie.movie_id,
        username,
      }));

      // Insert mapped movies to user_movie_list table
      const insertMovieList = pgp.helpers.insert(movieListItems, moviesListCs);
      await t.none(insertMovieList);
    });

    return res.status(200).json(success([{ name: 'import_success', message: 'Profile imported' }]));
  } catch (error) {
    Logger.error(error);
    next(new ErrorWithStatus(500, 'profile_import_error', "Couldn't import user data"));
  }
};

export {
  getProfile,
  getProfileV2,
  generateShareImage,
  deleteAccount,
  exportUserData,
  importUserData,
};
