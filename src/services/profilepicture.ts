import { NextFunction } from 'express';
import * as fs from 'node:fs/promises';
import { db } from '../db/config';
import { ErrorWithStatus } from '../util/errorhandler';
import { findProfilePicturePathByFileName } from '../db/users';
import { Logger } from '../util/logger';
import { TypedRequest, TypedResponse } from '../util/zod';
import { getProfilePictureSchema } from '../routes/profilepicture/schema';

export const getProfilePicture = async (
  req: TypedRequest<typeof getProfilePictureSchema>,
  res: TypedResponse,
  next: NextFunction,
) => {
  const { fileName } = req.params;
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
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(422, 'profile_picture_error', "Couldn't fetch profile picture"));
  }
};
