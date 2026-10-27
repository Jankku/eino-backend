import { NextFunction, Request } from 'express';
import multer from 'multer';
import { ErrorWithStatus } from '../util/errorhandler';
import { profilePictureLimits } from '../util/profilepicture';
import { TypedResponse } from '../util/zod';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: profilePictureLimits.fileSize,
    files: 1,
    fields: 0,
    parts: 1,
    fieldNameSize: 100,
    fieldSize: 1024,
  },
  fileFilter: (_, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new ErrorWithStatus(422, 'profile_picture_error', 'Invalid file type'));
      return;
    }
    // Multer's success callback requires null as the error argument.
    // eslint-disable-next-line unicorn/no-null
    callback(null, true);
  },
}).single('picture');

const parseUpload = (req: Request, res: TypedResponse) =>
  new Promise<void>((resolve, reject) => {
    upload(req, res, (error: unknown) => {
      if (!error) {
        resolve();
      } else if (error instanceof ErrorWithStatus) {
        reject(error);
      } else {
        const message =
          error instanceof multer.MulterError
            ? error.code === 'LIMIT_FILE_SIZE'
              ? 'File size exceeds 10MB'
              : error.message
            : 'Invalid multipart upload';
        reject(new ErrorWithStatus(422, 'profile_picture_error', message));
      }
    });
  });

type ProfilePictureHandler = (
  req: Request,
  res: TypedResponse,
  next: NextFunction,
) => Promise<void>;

const activeUploads = new Set<symbol>();

export const withProfilePictureUpload =
  (handler: ProfilePictureHandler) =>
  async (req: Request, res: TypedResponse, next: NextFunction) => {
    // Reserve before buffering, with no queue of retained upload buffers.
    if (activeUploads.size >= profilePictureLimits.concurrentUploads) {
      res.setHeader('Retry-After', '1');
      next(
        new ErrorWithStatus(
          503,
          'profile_picture_error',
          'Profile picture uploads are busy; try again later',
        ),
      );
      return;
    }

    const slot = Symbol('profile-picture-upload');
    activeUploads.add(slot);

    try {
      await parseUpload(req, res);
      if (res.destroyed) return;
      await handler(req, res, next);
    } catch (error) {
      next(error);
    } finally {
      activeUploads.delete(slot);
    }
  };
