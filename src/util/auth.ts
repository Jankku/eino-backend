import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { config } from '../config';

const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_VALIDITY, REFRESH_TOKEN_VALIDITY } =
  config;

const generateAccessToken = (userId: string, username: string): string =>
  jwt.sign({ userId, username }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_VALIDITY,
    audience: 'eino',
    issuer: 'eino-backend',
  });

const generateRefreshToken = (userId: string, username: string): string =>
  jwt.sign({ userId, username }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_VALIDITY,
    audience: 'eino',
    issuer: 'eino-backend',
  });

const generatePasswordHash = (password: string): Promise<string> => bcrypt.hash(password, 12);

export { generateAccessToken, generateRefreshToken, generatePasswordHash };
