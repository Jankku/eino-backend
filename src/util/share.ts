import crypto from 'node:crypto';
import path from 'node:path';
import * as fs from 'node:fs/promises';

const SHARE_PATH = './share/';
const IMAGE_EXTENSION = '.png';

export const createShareDir = async () => {
  await fs.mkdir(SHARE_PATH, { recursive: true });
};

export const getShareItemPath = (username: string) =>
  path.join(SHARE_PATH, `${username}${IMAGE_EXTENSION}`);

export const generateShareId = () => crypto.randomBytes(4).toString('hex');

export const getFontPath = (name: string) => path.join('./src', 'fonts', name);
