import crypto from 'node:crypto';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { z } from 'zod';
import { Logger } from './logger.ts';

const SHARE_PATH = path.resolve('./share/');

export const createShareDir = async () => {
  await fs.mkdir(SHARE_PATH, { recursive: true });
};

export const getShareItemPath = (userId: string) => {
  const filename = `${z.uuid().parse(userId).toLowerCase()}.avif`;
  const imagePath = path.resolve(SHARE_PATH, filename);
  if (path.dirname(imagePath) !== SHARE_PATH) {
    throw new Error('Share image path must be inside the share directory');
  }
  return imagePath;
};

// Runs after the user is deleted. A leftover file is harmless, so a failed removal
// must not fail the already committed deletion.
export const removeShareImage = async (userId: string) => {
  try {
    await fs.rm(getShareItemPath(userId), { force: true });
  } catch (error) {
    Logger.warn("Couldn't remove share image", { userId, error });
  }
};

export const generateShareId = () => crypto.randomBytes(16).toString('hex');

export const getFontPath = (name: string) => path.join('./src', 'fonts', name);
