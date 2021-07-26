import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ErrorHandler } from '../util/errorhandler';
import Logger from '../util/logger';

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    next(new ErrorHandler(401, 'no_authorization_header', 'Add Authorization header to request'));
    return;
  }

  try {
    jwt.verify(token, `${process.env.JWT_SECRET}`, { audience: 'eino', issuer: 'eino-backend' }, (err, decoded) => {
      res.locals.username = decoded?.username;
      if (err) next(new ErrorHandler(401, 'authorization_error', `${err?.message}`));
      else next();
    });
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(500, 'authorization_error', 'Unknown authorization error occurred'));
  }
};

export default verifyToken;
