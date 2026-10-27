import crypto from 'node:crypto';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { z } from 'zod';

const SHARE_PATH = path.resolve('./share/');
const IMAGE_EXTENSION = '.png';

export const createShareDir = async () => {
  await fs.mkdir(SHARE_PATH, { recursive: true });
};

export const getShareItemPath = (userId: string) => {
  const filename = `${z.uuid().parse(userId).toLowerCase()}${IMAGE_EXTENSION}`;
  const imagePath = path.resolve(SHARE_PATH, filename);
  if (path.dirname(imagePath) !== SHARE_PATH) {
    throw new Error('Share image path must be inside the share directory');
  }
  return imagePath;
};

export const generateShareId = () => crypto.randomBytes(4).toString('hex');

export const getFontPath = (name: string) => path.join('./src', 'fonts', name);
