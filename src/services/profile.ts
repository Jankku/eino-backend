import type { NextFunction, Request } from 'express';
import { db, pgp } from '../db/config.ts';
import {
  findProfilePictureByUserId,
  getItemCountByUserIdForUpdate,
  getUserById,
  isPasswordCorrect,
  updateProfilePicturePath,
} from '../db/users.ts';
import { ErrorWithStatus, SecurityErrorWithStatus } from '../util/errorhandler.ts';
import * as fs from 'node:fs/promises';
import { success } from '../util/response.ts';
import { Logger, logError } from '../util/logger.ts';
import { getAllBooks, getTop10BookTitles } from '../db/books.ts';
import { getAllMovies, getTop10MovieTitles } from '../db/movies.ts';
import { generateShareId, getShareItemPath, removeShareImage } from '../util/share.ts';
import { renderShareImage } from '../util/shareimagepool.ts';
import { createShare, getSharesByUserId } from '../db/share.ts';
import { getProfileData, getProfileDataV2 } from '../db/profile.ts';
import type {
  deleteAccountSchema,
  exportProfileSchema,
  generateShareImageSchema,
  importProfileSchema,
} from '../routes/profile/schema.ts';
import {
  booksCs,
  booksListCs,
  calculateBookHash,
  calculateMovieHash,
  moviesCs,
  moviesListCs,
} from '../util/profile.ts';
import { config } from '../config.ts';
import type { TypedResponse } from '../util/zod.ts';
import { findVerification } from '../db/verification.ts';
import { validateTOTP } from '../util/totp.ts';
import { addAudit, getAuditsByActorUserId } from '../db/audit.ts';
import {
  generateProfilePicturePath,
  profilePictureLimits,
  removeRetiredProfilePicture,
} from '../util/profilepicture.ts';
import sharp from 'sharp';

export const getProfile = async (_: Request, res: TypedResponse, next: NextFunction) => {
  const { userId, username } = res.locals;

  try {
    const { userInfo, bookData, bookScores, movieData, movieScores } = await db.task(
      async (t) => await getProfileData(t, userId),
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
    logError(error);
    next(new ErrorWithStatus(500, 'profile_error', "Couldn't fetch profile"));
  }
};

export const getProfileV2 = async (_req: Request, res: TypedResponse, next: NextFunction) => {
  const userId = res.locals.userId;
  try {
    const { userInfo, bookData, bookScores, movieData, movieScores } = await db.task(
      async (t) => await getProfileDataV2(t, userId),
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
    logError(error);
    next(new ErrorWithStatus(500, 'profile_error', "Couldn't fetch profile"));
  }
};

export const deleteAccount = async (
  _: Request,
  res: TypedResponse<typeof deleteAccountSchema>,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const { password, twoFactorCode } = res.locals.input.body;

  try {
    const profilePicturePath = await db.tx('deleteAccount', async (t) => {
      const user = await getUserById(t, res.locals.userId);

      if (user.totp_enabled_on) {
        if (!twoFactorCode) {
          throw new SecurityErrorWithStatus(
            422,
            'delete_account_error',
            'Two-factor code required',
            {
              operation: 'account_delete',
              reason: 'otp_required',
              targetUserId: res.locals.userId,
            },
          );
        }

        const twoFactorVerification = await findVerification(t, {
          userId: user.user_id,
          type: '2fa',
        });
        if (
          !twoFactorVerification ||
          !validateTOTP({ otp: twoFactorCode, ...twoFactorVerification })
        ) {
          throw new SecurityErrorWithStatus(
            422,
            'delete_account_error',
            'Incorrect two-factor code',
            { operation: 'account_delete', reason: 'invalid_otp', targetUserId: res.locals.userId },
          );
        }
      }

      const isCorrect = await isPasswordCorrect(t, { userId: res.locals.userId, password });
      if (!isCorrect) {
        throw new SecurityErrorWithStatus(422, 'delete_account_error', 'Incorrect password', {
          operation: 'account_delete',
          reason: 'invalid_credentials',
          targetUserId: res.locals.userId,
        });
      }

      await t.none('DELETE FROM users WHERE user_id = $1', user.user_id);
      await addAudit(t, {
        actor_user_id: res.locals.userId,
        username,
        action: 'account_deleted',
        old_data: { ...user, password: undefined },
      });
      return user.profile_picture_path;
    });

    // Files are removed only after the deletion commits.
    await removeShareImage(res.locals.userId);
    if (profilePicturePath) {
      await removeRetiredProfilePicture(profilePicturePath);
    }

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

export const generateShareImage = async (
  _req: Request,
  res: TypedResponse<typeof generateShareImageSchema>,
  next: NextFunction,
) => {
  try {
    const { userId, username } = res.locals;
    const { bookTitles, movieTitles, profilePicturePath } = await db.task(
      'generateShareImage',
      async (t) => {
        const bookTitles = await getTop10BookTitles(t, userId);
        const movieTitles = await getTop10MovieTitles(t, userId);
        const profilePicturePath = await findProfilePictureByUserId(t, userId);
        return { bookTitles, movieTitles, profilePicturePath };
      },
    );

    if (bookTitles.length === 0 && movieTitles.length === 0) {
      next(new ErrorWithStatus(422, 'profile_error', 'Not enough items for image creation'));
      return;
    }

    let profilePicture: Buffer | undefined;
    if (profilePicturePath) {
      try {
        profilePicture = await sharp(profilePicturePath).jpeg().toBuffer();
      } catch (error) {
        Logger.warn("Couldn't load profile picture for share image", { error });
      }
    }

    const imageBuffer = await renderShareImage({
      theme: res.locals.input.query.theme,
      username,
      bookTitles,
      movieTitles,
      profilePicture,
    });
    const shareImagePath = getShareItemPath(userId);
    const shareId = generateShareId();

    // The database cannot roll back file writes, so the image must exist before a share
    // row references it. The image is per user and replaced by every new share.
    await fs.writeFile(shareImagePath, imageBuffer);
    await db.tx('createShare', async (t) => {
      await createShare(t, { id: shareId, userId });
      await addAudit(t, { actor_user_id: userId, username, action: 'profile_shared' });
    });

    res.status(200).json(success([{ share_id: shareId }]));
  } catch (error) {
    Logger.error(error);
    next(new ErrorWithStatus(500, 'profile_error', "Couldn't share profile"));
  }
};

export const exportProfileData = async (
  _: Request,
  res: TypedResponse<typeof exportProfileSchema>,
  next: NextFunction,
) => {
  const username = res.locals.username;
  const { password, includeAuditLog } = res.locals.input.body;

  try {
    const { books, movies, profile, shares, audits } = await db.task(
      'exportProfileData',
      async (t) => {
        const isCorrect = await isPasswordCorrect(t, { userId: res.locals.userId, password });
        if (!isCorrect) {
          throw new SecurityErrorWithStatus(422, 'profile_export_error', 'Incorrect password', {
            operation: 'profile_export',
            reason: 'invalid_credentials',
            targetUserId: res.locals.userId,
          });
        }

        await addAudit(t, {
          actor_user_id: res.locals.userId,
          username,
          action: 'profile_data_exported',
        });

        const books = await getAllBooks(t, res.locals.userId);
        const movies = await getAllMovies(t, res.locals.userId);
        const profile = await getProfileDataV2(t, res.locals.userId);
        const shares = await getSharesByUserId(t, res.locals.userId);
        const audits = includeAuditLog ? await getAuditsByActorUserId(t, res.locals.userId) : [];

        return { books, movies, profile, shares, audits };
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
  _: Request,
  res: TypedResponse<typeof importProfileSchema>,
  next: NextFunction,
) => {
  const { body } = res.locals.input;
  const { userId, username } = res.locals;

  try {
    await db.tx('importProfileData', async (t) => {
      const { book_count, movie_count } = await getItemCountByUserIdForUpdate(t, userId);

      const maxItemCount = config.USER_LIST_ITEM_MAX_COUNT;

      if (
        body.books.length + book_count > maxItemCount ||
        body.movies.length + movie_count > maxItemCount
      ) {
        throw new ErrorWithStatus(
          422,
          'profile_import_error',
          `Item count exceeds the maximum of ${maxItemCount} items per list`,
        );
      }

      const bookHashMap = Object.fromEntries(
        body.books.map((book) => [calculateBookHash(book), book]),
      );
      const movieHashMap = Object.fromEntries(
        body.movies.map((movie) => [calculateMovieHash(movie), movie]),
      );

      const mapBooks = body.books.map((book) => ({ ...book, user_id: userId }));
      const mapMovies = body.movies.map((movie) => ({ ...movie, user_id: userId }));

      if (mapBooks.length > 0) {
        // Insert books to books table
        const newBooks = await t.many(pgp.helpers.insert(mapBooks, booksCs) + ' RETURNING *');

        // Map inserted books to be compatible with user_book_list table
        const bookListItems = newBooks.map((book) => ({
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-argument
          ...bookHashMap[calculateBookHash(book)],
          book_id: book.book_id,
        }));

        // Insert mapped books to user_book_list table
        const insertBookList = pgp.helpers.insert(bookListItems, booksListCs);
        await t.none(insertBookList);
      }

      if (mapMovies.length > 0) {
        // Insert movies to movies table
        const newMovies = await t.many(pgp.helpers.insert(mapMovies, moviesCs) + ' RETURNING *');

        // Map inserted movies to be compatible with user_movie_list table
        const movieListItems = newMovies.map((movie) => ({
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-argument
          ...movieHashMap[calculateMovieHash(movie)],
          movie_id: movie.movie_id,
        }));

        // Insert mapped movies to user_movie_list table
        const insertMovieList = pgp.helpers.insert(movieListItems, moviesListCs);
        await t.none(insertMovieList);
      }

      if (mapBooks.length > 0 || mapMovies.length > 0) {
        await addAudit(t, {
          actor_user_id: userId,
          username,
          action: 'profile_data_imported',
        });
      }
    });

    res.status(200).json(success([{ name: 'import_success', message: 'Profile imported' }]));
  } catch (error) {
    if (error instanceof ErrorWithStatus) {
      next(error);
      return;
    }
    Logger.error(error);
    next(new ErrorWithStatus(500, 'profile_import_error', "Couldn't import user data"));
  }
};

export const saveProfilePicture = async (req: Request, res: TypedResponse, next: NextFunction) => {
  const file = req.file;
  const { userId, username } = res.locals;
  try {
    if (!file || file.size === 0 || !file.buffer?.length) {
      next(
        new ErrorWithStatus(422, 'profile_picture_error', 'A non-empty picture file is required'),
      );
      return;
    }

    let image: Buffer;
    try {
      image = await sharp(file.buffer, {
        limitInputPixels: profilePictureLimits.inputPixels,
        animated: false,
        pages: 1,
      })
        .resize({ width: 300, height: 300, fit: 'cover' })
        .avif()
        .toBuffer();
    } catch {
      next(new ErrorWithStatus(422, 'profile_picture_error', `Invalid image`));
      return;
    }

    // The database cannot roll back file changes: write the new picture before referencing
    // it, and remove the old one only after the new reference is committed.
    const path = generateProfilePicturePath();
    // 'wx' refuses to overwrite another user's picture on a random path collision.
    await fs.writeFile(path, image, { flag: 'wx' });
    let oldProfilePicturePath: string | null;
    try {
      oldProfilePicturePath = await db.tx('saveProfilePicture', async (t) => {
        const oldPath = await findProfilePictureByUserId(t, userId);
        await updateProfilePicturePath(t, { userId, path });
        await addAudit(t, {
          actor_user_id: userId,
          username,
          action: 'profile_picture_updated',
          old_data: oldPath ? { path: oldPath } : undefined,
          new_data: { path },
        });
        return oldPath;
      });
    } catch (error) {
      await fs.rm(path, { force: true }).catch(() => {});
      throw error;
    }
    if (oldProfilePicturePath) {
      await removeRetiredProfilePicture(oldProfilePicturePath);
    }

    res
      .status(200)
      .json(success([{ name: 'profile_picture_uploaded', message: 'Profile picture uploaded' }]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'profile_picture_error', "Couldn't save profile picture"));
  }
};

export const deleteProfilePicture = async (_: Request, res: TypedResponse, next: NextFunction) => {
  const { userId, username } = res.locals;
  try {
    const oldProfilePicturePath = await db.tx('deleteProfilePicture', async (t) => {
      const oldPath = await findProfilePictureByUserId(t, userId);
      await updateProfilePicturePath(t, { userId, path: undefined });
      if (oldPath) {
        await addAudit(t, {
          actor_user_id: userId,
          username,
          action: 'profile_picture_updated',
          old_data: { path: oldPath },
        });
      }
      return oldPath;
    });
    // Removed only after the commit, so a failed transaction keeps a valid reference.
    if (oldProfilePicturePath) {
      await removeRetiredProfilePicture(oldProfilePicturePath);
    }
    res
      .status(200)
      .json(success([{ name: 'profile_picture_removed', message: 'Profile picture removed' }]));
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'profile_picture_error', "Couldn't remove profile picture"));
  }
};
