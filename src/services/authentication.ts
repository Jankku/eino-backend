import * as bcrypt from 'bcrypt';
import { NextFunction, Request, Response } from 'express';
import { getUserByUsername } from '../db/users';
import { query } from '../db/config';
import { success } from '../util/response';
import { validateCredientials, validationErrors } from '../util/validation';
import Logger from '../util/logger';
import { generateJwt, generatePasswordHash } from '../util/auth';
import { ErrorHandler } from '../util/errorhandler';
import User from '../db/model/user';

const register = async (req: Request, res: Response, next: NextFunction) => {
  const { username, password, password2 } = req.body;

  const isValid = await validateCredientials(username, password, password2);
  if (!isValid) {
    next(validationErrors);
    return;
  }

  try {
    const hashedPassword = generatePasswordHash(password);
    const q = {
      text: 'INSERT INTO users (username, password) VALUES ($1, $2)',
      values: [username, hashedPassword],
    };

    query(q, (err: Error) => {
      if (err) {
        Logger.error(err.stack);
        next(new ErrorHandler(500, 'authentication_error', 'Unknown error while trying to register user'));
        return;
      }

      res.status(200).json(success({ name: 'user_registered', message: username }));
    });
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(500, 'authentication_error', 'Unknown error while trying to register user'));
  }
};

const login = async (req: Request, res: Response, next: NextFunction) => {
  const { username, password } = req.body;

  try {
    getUserByUsername(username, (user: User | undefined) => {
      // User doesn't exist
      if (user === undefined) {
        next(new ErrorHandler(422, 'authentication_error', 'User not found'));
        return;
      }

      const userId = user.user_id;
      const hashedPassword = user.password;

      if (!bcrypt.compareSync(password, hashedPassword)) {
        next(new ErrorHandler(422, 'authentication_error', 'Incorrect password'));
        return;
      }

      const jwt = generateJwt(userId, username);
      return res.status(200).json({ token: jwt });
    });
  } catch (err) {
    Logger.error(err.stack);
    next(new ErrorHandler(500, 'authentication_error', 'Unknown error while trying to log-in user'));
  }
};

export default {
  register,
  login,
};
