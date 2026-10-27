import jwt from 'jsonwebtoken';
import { z } from 'zod';
import * as bcrypt from 'bcrypt';
import { config } from '../config';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';
import * as zxcvbnFi from '@zxcvbn-ts/language-fi';
import { User } from '../db/users';
import { roleIdToName } from './role';
import { jwtConstants } from './jwtconstants';

const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_VALIDITY, REFRESH_TOKEN_VALIDITY } =
  config;

const zxcvbn = new ZxcvbnFactory({
  graphs: zxcvbnCommon.adjacencyGraphs,
  dictionary: { ...zxcvbnCommon.dictionary, ...zxcvbnEn.dictionary, ...zxcvbnFi.dictionary },
  translations: zxcvbnEn.translations,
});

export type AccessTokenPayload = {
  sub: string;
  userId: string;
  username: string;
  role: string;
  is2FAEnabled: boolean;
};

export const generateAccessToken = (user: User): string =>
  jwt.sign(
    {
      sub: user.user_id,
      userId: user.user_id,
      username: user.username,
      role: roleIdToName(user.role_id),
      is2FAEnabled: user.totp_enabled_on ? true : false,
    } satisfies AccessTokenPayload,
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_VALIDITY as jwt.SignOptions['expiresIn'],
      audience: jwtConstants.AUDIENCE,
      issuer: jwtConstants.ISSUER,
    },
  );

export type RefreshTokenPayload = { sub: string };

export const getTokenSubject = (payload: jwt.JwtPayload | string): string => {
  const subject = z.uuid().safeParse(typeof payload === 'string' ? undefined : payload.sub);
  if (!subject.success) {
    throw new jwt.JsonWebTokenError('Invalid token subject');
  }
  return subject.data;
};

export const generateRefreshToken = (user: User): string =>
  jwt.sign({ sub: user.user_id } satisfies RefreshTokenPayload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_VALIDITY as jwt.SignOptions['expiresIn'],
    audience: jwtConstants.AUDIENCE,
    issuer: jwtConstants.ISSUER,
  });

export const generatePasswordHash = (password: string): Promise<string> =>
  bcrypt.hash(password, 12);

type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export const getPasswordStrength = ({
  username = '',
  password,
}: {
  username?: string;
  password: string;
}): { isStrong: boolean; score: PasswordStrengthScore; error: string } => {
  const { score, feedback } = zxcvbn.check(password, ['eino', username]);

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
