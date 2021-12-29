import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ErrorWithStatus } from '../util/errorhandler';
import Logger from '../util/logger';

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const accessToken = req.headers.authorization?.split(' ')[1];

  if (!accessToken) {
    next(new ErrorWithStatus(401, 'no_authorization_header', 'Add Authorization header to request'));
    return;
  }

  try {
    jwt.verify(
      accessToken,
      `${process.env.ACCESS_TOKEN_SECRET}`,
      {
        audience: 'eino',
        issuer: 'eino-backend',
      },
      (error, decoded) => {
        if (error) {
          next(new ErrorWithStatus(401, 'authorization_error', `${error?.message}`));
        } else {
          res.locals.username = decoded?.username;
          next();
        }
      }
    );
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(500, 'authorization_error', 'Unknown authorization error occurred'));
  }
};

export default verifyToken;
