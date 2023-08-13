import crypto from 'node:crypto';
import path from 'node:path';
import * as fs from 'node:fs/promises';

const SHARE_PATH = './share/';
const IMAGE_EXTENSION = '.png';

const createShareDir = async () => {
  try {
    await fs.mkdir(SHARE_PATH, { recursive: true });
  } catch {
    throw new Error('Failed to create share directory');
  }
};

const getSharePath = () => path.join(SHARE_PATH);

const getShareItemPath = (username: string) =>
  path.join(SHARE_PATH, `${username}${IMAGE_EXTENSION}`);

const generateShareId = () => crypto.randomBytes(4).toString('hex');

const getFontPath = (name: string) => path.join('./src', 'fonts', name);

export { createShareDir, getSharePath, getShareItemPath, generateShareId, getFontPath };
