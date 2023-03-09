import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import config from '../config';
import JwtPayload from '../model/jwtpayload';
import { ErrorWithStatus } from '../util/errorhandler';
import { formatZodErrors } from '../util/zod';

const tokenSchema = z.object({
  headers: z.object({
    authorization: z
      .string({ required_error: 'Authorization header required' })
      .refine((val) => val.split(' ')[0] === 'Bearer', {
        params: {
          name: 'authorization_error',
        },
        message: 'Authorization header must be Bearer',
      })
      .transform((val) => val.split(' ')[1]),
  }),
});

/**
 * Verifies that user's access token is valid
 */
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = tokenSchema.parse(req).headers.authorization;
    const { username } = jwt.verify(accessToken, config.ACCESS_TOKEN_SECRET, {
      audience: 'eino',
      issuer: 'eino-backend',
    }) as JwtPayload;

    res.locals.username = username;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      next(formatZodErrors(error));
    } else {
      next(new ErrorWithStatus(401, 'authorization_error', `${(error as Error)?.message}`));
    }
  }
};

export default verifyToken;
