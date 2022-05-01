import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import JwtPayload from '../model/jwtpayload';
import { ErrorWithStatus } from '../util/errorhandler';
import Logger from '../util/logger';


const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const accessToken = req.headers.authorization?.split(' ')[1];

  if (!accessToken) {
    next(
      new ErrorWithStatus(401, 'no_authorization_header', 'Add Authorization header to request')
    );
    return;
  }

  try {
    const { username } = jwt.verify(accessToken, `${process.env.ACCESS_TOKEN_SECRET}`, {
      audience: 'eino',
      issuer: 'eino-backend',
    }) as JwtPayload;

    res.locals.username = username;
    next();
  } catch (error) {
    Logger.error((error as Error).stack);
    next(new ErrorWithStatus(401, 'authorization_error', `${(error as Error)?.message}`));
  }
};

export default verifyToken;
