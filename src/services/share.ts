import { NextFunction, Request, Response } from 'express';
import * as fs from 'node:fs/promises';
import { getShare } from '../db/share';
import { ErrorWithStatus } from '../util/errorhandler';
import Logger from '../util/logger';
import { getShareItemPath } from '../util/share';

const getShareImage = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  try {
    const share = await getShare(id);
    const imagePath = getShareItemPath(share.username);
    const shareImage = await fs.readFile(imagePath);
    res.set({ 'Content-Type': 'image/png' }).send(shareImage);
  } catch (error) {
    Logger.error(error);
    next(new ErrorWithStatus(422, 'share_error', "Couldn't find share"));
  }
};

export { getShareImage };
