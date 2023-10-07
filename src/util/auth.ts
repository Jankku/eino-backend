import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { config } from '../config';
import { zxcvbn, zxcvbnOptions, Options } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';
import * as zxcvbnFi from '@zxcvbn-ts/language-fi';

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

const initZxcvbn = () => {
  const options: Partial<Options> = {
    graphs: zxcvbnCommon.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommon.dictionary,
      ...zxcvbnEn.dictionary,
      ...zxcvbnFi.dictionary,
    },
    translations: zxcvbnEn.translations,
  };
  zxcvbnOptions.setOptions(options);
};

const getPasswordStrength = ({
  username = '',
  password,
}: {
  username?: string;
  password: string;
}): { isStrong: boolean; score: number; error: string } => {
  const { score, feedback } = zxcvbn(password, ['eino', username]);

  const isStrong = score > 2; // 0-4

  if (isStrong) return { isStrong, score, error: '' };

  const warning = feedback.warning || '';
  const suggestions =
    feedback.suggestions.length > 0
      ? feedback.suggestions.join(' ')
      : 'Try a more complex password.';
  const error = ['Password is too weak.', warning || suggestions].filter(Boolean).join(' ');

  return { isStrong, score, error };
};

export {
  generateAccessToken,
  generateRefreshToken,
  generatePasswordHash,
  initZxcvbn,
  getPasswordStrength,
};
