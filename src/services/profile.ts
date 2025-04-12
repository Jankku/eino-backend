import { NextFunction, Request } from 'express';
import { db, pgp } from '../db/config';
import {
  findProfilePictureByUsername,
  getItemCountByUsername,
  getUserByUsername,
  isPasswordCorrect,
  updateProfilePicturePath,
} from '../db/users';
import { ErrorWithStatus } from '../util/errorhandler';
import * as fs from 'node:fs/promises';
import { success } from '../util/response';
import { Logger } from '../util/logger';
import { registerFont, createCanvas } from 'canvas';
import { getAllBooks, getTop10BookTitles } from '../db/books';
import { getAllMovies, getTop10MovieTitles } from '../db/movies';
import { generateShareId, getFontPath, getShareItemPath } from '../util/share';
import { createShare, getSharesByUsername } from '../db/share';
import { DateTime } from 'luxon';
import { getProfileData, getProfileDataV2 } from '../db/profile';
import {
  deleteAccountSchema,
  exportProfileSchema,
  importProfileSchema,
} from '../routes/profile/schema';
import {
  booksCs,
  booksListCs,
  calculateBookHash,
  calculateMovieHash,
  moviesCs,
  moviesListCs,
} from '../util/profile';
import { config } from '../config';
import { TypedRequest, TypedResponse } from '../util/zod';
import { getVerification } from '../db/verification';
import { validateTOTP } from '../util/totp';
import { addAudit, getAuditsByUsername } from '../db/audit';
import { generateProfilePicturePath } from '../util/profilepicture';
import sharp from 'sharp';

export const getProfile = async (_: Request, res: TypedResponse, next: NextFunction) => {
  const username = res.locals.username;

  try {
    const { userInfo, bookData, bookScores, movieData, movieScores } = await db.task(
      async (t) => await getProfileData(t, username),
    );

    res.status(200).json({
      user_id: userInfo.user_id,
      username: username,
      registration_date: userInfo.registration_date,
      stats: {
        book: {
          ...bookData,
          score_distribution: bookScores,
        },
        movie: {
          ...movieData,
          score_distribution: movieScores,
        },
      },
    });
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'profile_error', "Couldn't fetch profile"));
  }
};

export const getProfileV2 = async (_req: Request, res: TypedResponse, next: NextFunction) => {
  const username = res.locals.username;
  try {
    const { userInfo, bookData, bookScores, movieData, movieScores } = await db.task(
      async (t) => await getProfileDataV2(t, username),
    );
    res.status(200).json({
      ...userInfo,
      stats: {
        book: {
          ...bookData,
          score_distribution: bookScores,
        },
        movie: {
          ...movieData,
          score_distribution: movieScores,
        },
      },
    });
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'profile_error', "Couldn't fetch profile"));
  }
};

export const deleteAccount = async (
  req: TypedRequest<typeof deleteAccountSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const { password, twoFactorCode } = req.body;

  try {
    await db.tx('deleteAccount', async (t) => {
      const user = await getUserByUsername(t, username);

      if (user.totp_enabled_on) {
        if (!twoFactorCode) {
          throw new ErrorWithStatus(422, 'delete_account_error', 'Two-factor code required');
        }

        const twoFactorVerification = await getVerification(t, {
          target: user.username,
          type: '2fa',
        });
        if (!validateTOTP({ otp: twoFactorCode, ...twoFactorVerification })) {
          throw new ErrorWithStatus(422, 'delete_account_error', 'Incorrect two-factor code');
        }
      }

      const isCorrect = await isPasswordCorrect(t, { username, password });
      if (!isCorrect) {
        throw new ErrorWithStatus(422, 'delete_account_error', 'Incorrect password');
      }

      await t.none('DELETE FROM users WHERE username = $1', username);
      await addAudit(t, {
        username,
        action: 'account_deleted',
        old_data: { ...user, password: undefined },
      });
    });

    const shareImagePath = getShareItemPath(username);
    await fs.rm(shareImagePath, { force: true });

    res
      .status(200)
      .json(success([{ name: 'account_deleted', message: 'Account successfully deleted' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error(error);
      next(new ErrorWithStatus(500, 'delete_account_error', "Couldn't delete account"));
    }
  }
};

export const generateShareImage = async (_req: Request, res: TypedResponse, next: NextFunction) => {
  try {
    const username = res.locals.username;
    const { bookTitles, movieTitles } = await db.task('generateShareImage', async (t) => {
      const bookTitles = await getTop10BookTitles(t, username);
      const movieTitles = await getTop10MovieTitles(t, username);
      return { bookTitles, movieTitles };
    });

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

    await db.tx('createShare', async (t) => {
      await createShare(t, { id: shareId, username });
      await addAudit(t, { username, action: 'profile_shared' });
    });
    await fs.writeFile(shareImagePath, imageBuffer);

    res.status(200).json(success([{ share_id: shareId }]));
  } catch (error) {
    Logger.error(error);
    next(new ErrorWithStatus(500, 'profile_error', "Couldn't share profile"));
  }
};

export const exportProfileData = async (
  req: TypedRequest<typeof exportProfileSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const { password, includeAuditLog } = req.body;

  try {
    const [books, movies, profile, shares, audits] = await db.task(
      'exportProfileData',
      async (t) => {
        const isCorrect = await isPasswordCorrect(t, { username, password });
        if (!isCorrect) {
          throw new ErrorWithStatus(422, 'profile_export_error', 'Incorrect password');
        }

        await addAudit(t, { username, action: 'profile_data_exported' });

        return Promise.all([
          getAllBooks(t, username),
          getAllMovies(t, username),
          getProfileDataV2(t, username),
          getSharesByUsername(t, username),
          includeAuditLog ? getAuditsByUsername(t, username) : [],
        ]);
      },
    );

    res.status(200).json({
      version: 5,
      profile: {
        ...profile.userInfo,
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
      audits,
    });
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
    } else {
      Logger.error(error);
      next(new ErrorWithStatus(500, 'profile_error', "Couldn't export user data"));
    }
  }
};

export const importProfileData = async (
  req: TypedRequest<typeof importProfileSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { body } = req;
  const username = res.locals.username;

  try {
    await db.tx('importProfileData', async (t) => {
      const { book_count, movie_count } = await getItemCountByUsername(t, username);

      const maxItemCount = config.USER_LIST_ITEM_MAX_COUNT;

      if (
        body.books.length + book_count > maxItemCount ||
        body.movies.length + movie_count > maxItemCount
      ) {
        next(
          new ErrorWithStatus(
            422,
            'profile_import_error',
            `Item count exceeds the maximum of ${maxItemCount} items per list`,
          ),
        );
        return;
      }

      const bookHashMap = Object.fromEntries(
        body.books.map((book) => [calculateBookHash(book), book]),
      );
      const movieHashMap = Object.fromEntries(
        body.movies.map((movie) => [calculateMovieHash(movie), movie]),
      );

      const mapBooks = body.books.map((book) => ({ ...book, submitter: username }));
      const mapMovies = body.movies.map((movie) => ({ ...movie, submitter: username }));

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

      await addAudit(t, { username, action: 'profile_data_imported' });
    });

    res.status(200).json(success([{ name: 'import_success', message: 'Profile imported' }]));
  } catch (error) {
    Logger.error(error);
    next(new ErrorWithStatus(500, 'profile_import_error', "Couldn't import user data"));
  }
};

export const saveProfilePicture = async (req: Request, res: TypedResponse, next: NextFunction) => {
  const file = req.file;
  const username = res.locals.username;
  try {
    if (!file) {
      await db.tx('saveProfilePicture', async (t) => {
        const oldProfilePicturePath = await findProfilePictureByUsername(t, username);
        await updateProfilePicturePath(t, { username, path: undefined });
        if (oldProfilePicturePath) {
          await addAudit(t, {
            username,
            action: 'profile_picture_updated',
            old_data: { path: oldProfilePicturePath },
          });
          await fs.rm(oldProfilePicturePath, { force: true });
        }
      });
      res
        .status(200)
        .json(success([{ name: 'profile_picture_removed', message: 'Profile picture removed' }]));
      return;
    }

    if (!file.mimetype.startsWith('image/')) {
      next(new ErrorWithStatus(422, 'profile_picture_error', 'Invalid file type'));
      return;
    }

    const TEN_MB = 10 * 1024 * 1024;
    if (file.size > TEN_MB) {
      next(new ErrorWithStatus(422, 'profile_picture_error', 'File size exceeds 10MB'));
      return;
    }

    await db.tx('saveProfilePicture', async (t) => {
      const path = generateProfilePicturePath();
      const oldProfilePicturePath = await findProfilePictureByUsername(t, username);
      if (oldProfilePicturePath) {
        await fs.rm(oldProfilePicturePath, { force: true });
      }
      await updateProfilePicturePath(t, { username, path });
      await addAudit(t, {
        username,
        action: 'profile_picture_updated',
        old_data: oldProfilePicturePath ? { path: oldProfilePicturePath } : undefined,
        new_data: { path },
      });
      await sharp(file.buffer)
        .resize({ width: 200, height: 200, fit: 'cover' })
        .avif()
        .toFile(path);
    });

    res
      .status(200)
      .json(success([{ name: 'profile_picture_uploaded', message: 'Profile picture uploaded' }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'profile_picture_error', "Couldn't save profile picture"));
  }
};
