import * as bcrypt from 'bcrypt';
import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getUserByUsername } from '../db/users';
import { db } from '../db/config';
import { success } from '../util/response';
import Logger from '../util/logger';
import {
  generateAccessToken,
  generatePasswordHash,
  generateRefreshToken,
  getPasswordStrength,
  updateLastLogin,
} from '../util/auth';
import { ErrorWithStatus } from '../util/errorhandler';
import JwtPayload from '../model/jwtpayload';
import { config } from '../config';
import { TypedRequest } from '../util/zod';
import {
  loginSchema,
  passwordStrengthSchema,
  refreshTokenSchema,
  registerSchema,
} from '../routes/auth';

const register = async (
  req: TypedRequest<typeof registerSchema>,
  res: Response,
  next: NextFunction,
) => {
  const { username, password, email } = req.body;

  try {
    const hashedPassword = await generatePasswordHash(password);
    await db.none({
      text: `INSERT INTO users (username, password, email)
             VALUES ($1, $2, $3)`,
      values: [username, hashedPassword, email],
    });
    res.status(200).json(success([{ name: 'user_registered', message: username }]));
  } catch (error) {
    Logger.error((error as Error).stack);
    next(
      new ErrorWithStatus(
        500,
        'authentication_error',
        'Unknown error while trying to register user',
      ),
    );
  }
};

const login = async (req: TypedRequest<typeof loginSchema>, res: Response, next: NextFunction) => {
  const { username, password } = req.body;

  try {
    const user = await getUserByUsername(username);

    const isCorrect = await bcrypt.compare(password, user.password);
    if (!isCorrect) {
      next(new ErrorWithStatus(422, 'authentication_error', 'Incorrect username or password'));
      return;
    }

    await updateLastLogin(user.user_id);

    const accessToken = generateAccessToken(user.user_id, username);
    const refreshToken = generateRefreshToken(user.user_id, username);

    return res.status(200).json({ accessToken, refreshToken });
  } catch (error) {
    Logger.error((error as Error).stack);
    next(
      new ErrorWithStatus(500, 'authentication_error', 'Unknown error while trying to log-in user'),
    );
  }
};

const generateNewAccessToken = (
  req: TypedRequest<typeof refreshTokenSchema>,
  res: Response,
  next: NextFunction,
) => {
  const { refreshToken } = req.body;

  try {
    const { userId, username } = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET, {
      audience: 'eino',
      issuer: 'eino-backend',
    }) as JwtPayload;

    const newAccessToken = generateAccessToken(userId, username);
    return res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    next(new ErrorWithStatus(422, 'jwt_refresh_error', (error as Error)?.message));
  }
};

const passwordStrength = (
  req: TypedRequest<typeof passwordStrengthSchema>,
  res: Response,
  next: NextFunction,
) => {
  const { password } = req.body;

  try {
    const { isStrong, score, error } = getPasswordStrength({ password });
    if (!isStrong) {
      res.status(200).json(success([{ message: error, score }]));
      return;
    }

    res.status(200).json(success([{ message: 'Password is strong', score }]));
  } catch {
    next(
      new ErrorWithStatus(500, 'password_strength_error', 'Unknown error while checking password'),
    );
  }
};

export { register, login, generateNewAccessToken, passwordStrength };
