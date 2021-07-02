import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { error } from '../util/response';

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(400).json(error({ code: 'no_authorization_header', message: 'No Authorization header' }));

  try {
    if (jwt.verify(token, `${process.env.JWT_SECRET}`)) next();
    else return res.sendStatus(401);
  } catch (err) {
    res.status(400).json(err);
  }
};

export default verifyToken;
