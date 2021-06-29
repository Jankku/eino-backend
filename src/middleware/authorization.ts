import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization;
  if (!token) return res.sendStatus(401).end();

  try {
    if (jwt.verify(token, `${process.env.JWT_SECRET}`)) next();
    else return res.sendStatus(401);
  } catch (error) {
    res.send(400).json(error);
  }
};

export default verifyToken;
