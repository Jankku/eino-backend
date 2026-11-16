import type { Request } from 'express';
import * as fs from 'node:fs/promises';
import { getShare } from '../db/share.ts';
import { getShareItemPath } from '../util/share.ts';
import { ErrorWithStatus } from '../util/errorhandler.ts';
import { Logger } from '../util/logger.ts';
import { isFileNotFound } from '../util/file.ts';
import type { TypedResponse } from '../util/zod.ts';
import type { getShareImageSchema } from '../routes/share/index.ts';
import { db } from '../db/config.ts';

export const getShareImage = async (_: Request, res: TypedResponse<typeof getShareImageSchema>) => {
  const { id } = res.locals.input.params;

  const share = await db.task('getShareImage', async (t) => await getShare(t, id));
  let shareImage: Buffer;
  try {
    shareImage = await fs.readFile(getShareItemPath(share.user_id));
  } catch (error) {
    if (!isFileNotFound(error)) throw error;
    Logger.warn('Share image file is missing', { shareId: id });
    throw new ErrorWithStatus(404, 'share_error', 'Share image not found');
  }
  res.set({ 'Content-Type': 'image/avif' }).send(shareImage);
};
