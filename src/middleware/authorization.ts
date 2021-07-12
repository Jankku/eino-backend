import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Logger from '../util/logger';
import { error } from '../util/response';
import { clearErrors } from '../util/validation';

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json(error([{ code: 'no_authorization_header', message: 'No Authorization header' }]));
    clearErrors();
    return;
  }

  try {
    jwt.verify(token, `${process.env.JWT_SECRET}`, (err, decoded) => {
      res.locals.username = decoded?.username;
      next(err);
    });
  } catch (err) {
    Logger.error(err.stack);
    res.status(400).json(error([{ code: 'authorization_error', message: 'Authorization error' }]));
  }
};

export default verifyToken;
