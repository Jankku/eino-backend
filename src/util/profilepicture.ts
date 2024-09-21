import crypto from 'node:crypto';
import path from 'node:path';
import * as fs from 'node:fs/promises';

const PROFILE_PICTURE_PATH = './profilepicture/';
const IMAGE_EXTENSION = '.avif';

export const createProfilePictureDir = async () => {
  await fs.mkdir(PROFILE_PICTURE_PATH, { recursive: true });
};

export const generateProfilePicturePath = () =>
  path.join(PROFILE_PICTURE_PATH, `${crypto.randomBytes(4).toString('hex')}${IMAGE_EXTENSION}`);

export const getProfilePicturePathByFileName = (fileName: string) =>
  path.join(PROFILE_PICTURE_PATH, fileName);
