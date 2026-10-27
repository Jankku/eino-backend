import crypto from 'node:crypto';
import path from 'node:path';
import * as fs from 'node:fs/promises';

export const profilePictureLimits = {
  fileSize: 10 * 1024 * 1024,
  inputPixels: 16_000_000,
  concurrentUploads: 2,
} as const;

const PROFILE_PICTURE_PATH = './profilepicture/';
const IMAGE_EXTENSION = '.avif';

export const createProfilePictureDir = async () => {
  await fs.mkdir(PROFILE_PICTURE_PATH, { recursive: true });
};

export const generateProfilePicturePath = () =>
  path.join(PROFILE_PICTURE_PATH, `${crypto.randomBytes(4).toString('hex')}${IMAGE_EXTENSION}`);

export const getProfilePicturePathByFileName = (fileName: string) =>
  path.join(PROFILE_PICTURE_PATH, fileName);
