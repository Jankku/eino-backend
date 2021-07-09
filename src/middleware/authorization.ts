import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Logger from '../util/logger';
import { error } from '../util/response';
import { clearErrors, validationErrors } from '../util/validation';

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    validationErrors.push({ code: 'no_authorization_header', message: 'No Authorization header' });
    res.status(400).json(error(validationErrors));
    clearErrors();
    return;
  }

  try {
    jwt.verify(token, `${process.env.JWT_SECRET}`, (err, decoded) => {
      res.locals.username = decoded?.username;
      next(err);
    });
  } catch (err) {
    Logger.error(err);
    res.status(400).json(err);
  }
};

export default verifyToken;
