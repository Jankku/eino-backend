import type { NextFunction, Request } from 'express';
import * as fs from 'node:fs/promises';
import { db } from '../db/config.ts';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { findProfilePicturePathByFileName } from '../db/users.ts';
import { logError } from '../util/logger.ts';
import type { TypedResponse } from '../util/zod.ts';
import type { getProfilePictureSchema } from '../routes/profilepicture/schema.ts';

export const getProfilePicture = async (
  _: Request,
  res: TypedResponse<typeof getProfilePictureSchema>,
  next: NextFunction,
) => {
  const { fileName } = res.locals.input.params;
  try {
    const path = await db.task('getProfilePicture', (t) =>
      findProfilePicturePathByFileName(t, fileName),
    );

    if (!path) {
      next(new ErrorWithStatus(422, 'profile_picture_error', 'No profile picture found'));
      return;
    }

    const profilePicture = await fs.readFile(path);
    res.set({ 'Content-Type': 'image/avif' }).send(profilePicture);
  } catch (error) {
    logError(error);
    next(new ErrorWithStatus(500, 'profile_picture_error', "Couldn't fetch profile picture"));
  }
};
