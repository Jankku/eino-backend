import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ErrorHandler } from '../util/errorhandler';
import Logger from '../util/logger';

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const accessToken = req.headers.authorization?.split(' ')[1];

  if (!accessToken) {
    next(new ErrorHandler(401, 'no_authorization_header', 'Add Authorization header to request'));
    return;
  }

  try {
    jwt.verify(accessToken, `${process.env.ACCESS_TOKEN_SECRET}`, { audience: 'eino', issuer: 'eino-backend' }, (err, decoded) => {
      if (err) {
        next(new ErrorHandler(401, 'authorization_error', `${err?.message}`));
      } else {
        res.locals.username = decoded?.username;
        next();
      }
    });
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(500, 'authorization_error', 'Unknown authorization error occurred'));
  }
};

export default verifyToken;
