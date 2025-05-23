import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import { config } from '../config';
import { ErrorWithStatus } from '../util/errorhandler';
import { formatZodErrors } from '../util/zod';
import { AccessTokenPayload } from '../util/auth';

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
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = tokenSchema.parse(req).headers.authorization;
    const { userId, username, role } = jwt.verify(accessToken, config.ACCESS_TOKEN_SECRET, {
      audience: 'eino',
      issuer: 'eino-backend',
    }) as AccessTokenPayload;

    res.locals.userId = userId;
    res.locals.username = username;
    res.locals.role = role;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      next(formatZodErrors(error));
    } else {
      next(new ErrorWithStatus(401, 'authorization_error', `${(error as Error)?.message}`));
    }
  }
};
