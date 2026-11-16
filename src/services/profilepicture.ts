import type { Request } from 'express';
import * as fs from 'node:fs/promises';
import { db } from '../db/config.ts';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { findProfilePicturePathByFileName } from '../db/users.ts';
import type { TypedResponse } from '../util/zod.ts';
import { Logger } from '../util/logger.ts';
import { isFileNotFound } from '../util/file.ts';
import type { getProfilePictureSchema } from '../routes/profilepicture/schema.ts';

export const getProfilePicture = async (
  _: Request,
  res: TypedResponse<typeof getProfilePictureSchema>,
) => {
  const { fileName } = res.locals.input.params;
  const path = await db.task('getProfilePicture', (t) =>
    findProfilePicturePathByFileName(t, fileName),
  );

  const notFound = new ErrorWithStatus(404, 'profile_picture_error', 'No profile picture found');
  if (!path) throw notFound;

  let profilePicture: Buffer;
  try {
    profilePicture = await fs.readFile(path);
  } catch (error) {
    if (!isFileNotFound(error)) throw error;
    Logger.warn('Profile picture file is missing', { fileName });
    throw notFound;
  }
  res.set({ 'Content-Type': 'image/avif' }).send(profilePicture);
};
