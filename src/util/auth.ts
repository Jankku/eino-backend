import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { config } from '../config';
import { zxcvbn, zxcvbnOptions, Options } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';
import * as zxcvbnFi from '@zxcvbn-ts/language-fi';
import { db } from '../db/config';
import User from '../db/model/user';

const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_VALIDITY, REFRESH_TOKEN_VALIDITY } =
  config;

const generateAccessToken = (user: User): string =>
  jwt.sign(
    {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      is2FAEnabled: user.totp_enabled_on ? true : false,
    },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_VALIDITY,
      audience: 'eino',
      issuer: 'eino-backend',
    },
  );

const generateRefreshToken = (user: User): string =>
  jwt.sign(
    {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      is2FAEnabled: user.totp_enabled_on ? true : false,
    },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_VALIDITY,
      audience: 'eino',
      issuer: 'eino-backend',
    },
  );

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

type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

const getPasswordStrength = ({
  username = '',
  password,
}: {
  username?: string;
  password: string;
}): { isStrong: boolean; score: PasswordStrengthScore; error: string } => {
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

const updateLastLogin = async (userId: string): Promise<void> => {
  await db.none({
    text: `UPDATE users
             SET last_login_on = CURRENT_TIMESTAMP(0)
             WHERE user_id = $1`,
    values: [userId],
  });
};

export {
  generateAccessToken,
  generateRefreshToken,
  generatePasswordHash,
  initZxcvbn,
  getPasswordStrength,
  updateLastLogin,
};
