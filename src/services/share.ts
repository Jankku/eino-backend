import type { NextFunction, Request } from 'express';
import * as fs from 'node:fs/promises';
import { getShare } from '../db/share.ts';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { Logger } from '../util/logger.ts';
import { getShareItemPath } from '../util/share.ts';
import type { TypedResponse } from '../util/zod.ts';
import type { getShareImageSchema } from '../routes/share/index.ts';
import { db } from '../db/config.ts';

export const getShareImage = async (
  _: Request,
  res: TypedResponse<typeof getShareImageSchema>,
  next: NextFunction,
) => {
  const { id } = res.locals.input.params;

  try {
    const share = await db.task('getShareImage', async (t) => {
      return await getShare(t, id);
    });
    const imagePath = getShareItemPath(share.user_id);
    const shareImage = await fs.readFile(imagePath);
    res.set({ 'Content-Type': 'image/avif' }).send(shareImage);
  } catch (error) {
    Logger.error(error);
    next(new ErrorWithStatus(422, 'share_error', "Couldn't find share"));
  }
};
