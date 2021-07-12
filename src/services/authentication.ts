import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import validator from 'validator';
import { getUserByUsername } from '../db/users';
import { query } from '../db/config';
import User from '../db/model/user';
import { success, error } from '../util/response';
import { clearErrors, validateCredientials, validationErrors } from '../util/validation';
import Logger from '../util/logger';
import { generateJwtToken, generatePasswordHash } from '../util/auth';

const register = async (req: Request, res: Response) => {
  const userId = uuidv4();
  const { username, password } = req.body;

  const isValid = await validateCredientials(username, password);
  if (!isValid) {
    res.status(422).json(error(validationErrors));
    clearErrors();
    return;
  }

  try {
    const hashedPassword = generatePasswordHash(password);
    const q = {
      text: 'INSERT INTO users (user_id, username, password) VALUES ($1, $2, $3)',
      values: [userId, validator.trim(username), hashedPassword],
    };

    query(q, (err: Error) => {
      if (err) {
        Logger.error(err.stack);
        res.sendStatus(400);
      } else {
        res.status(200).json(success({ code: 'user_registered', message: username }));
      }
    });
  } catch (err) {
    Logger.error(err.stack);
    res.sendStatus(500);
  }
};

const login = async (req: Request, res: Response) => {
  const { username } = req.body;
  const { password } = req.body;

  try {
    getUserByUsername(username, (user: User[]) => {
      if (user.length === 0) {
        validationErrors.push({ code: 'user_not_found', message: 'User not found' });
        res.status(422).json(error(validationErrors));
        clearErrors();
        return;
      }

      const userId = user[0].id;
      const hashedPassword = user[0].password;

      if (!bcrypt.compareSync(password, hashedPassword)) {
        validationErrors.push({ code: 'password_incorrect', message: 'Wrong password' });
        res.status(422).json(error(validationErrors));
        clearErrors();
        return;
      }

      const jwtToken = generateJwtToken(userId, username);
      return res.status(200).json({ token: jwtToken });
    });
  } catch (err) {
    Logger.error(err.stack);
    res.sendStatus(500);
  }
};

export default {
  register,
  login,
};
