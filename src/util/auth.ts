import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.ts';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';
import * as zxcvbnFi from '@zxcvbn-ts/language-fi';
import type { User } from '../db/users.ts';
import { roleIdToName } from './role.ts';
import { jwtConstants } from './jwtconstants.ts';

const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_VALIDITY, REFRESH_TOKEN_VALIDITY } =
  config;

const zxcvbn = new ZxcvbnFactory({
  graphs: zxcvbnCommon.adjacencyGraphs,
  dictionary: { ...zxcvbnCommon.dictionary, ...zxcvbnEn.dictionary, ...zxcvbnFi.dictionary },
  translations: zxcvbnEn.translations,
});

type AccessTokenPayload = {
  sub: string;
  userId: string;
  username: string;
  role: string;
  is2FAEnabled: boolean;
  ver: number;
};

export const generateAccessToken = (user: User): string =>
  jwt.sign(
    {
      sub: user.user_id,
      userId: user.user_id,
      username: user.username,
      role: roleIdToName(user.role_id),
      is2FAEnabled: !!user.totp_enabled_on,
      ver: user.token_version,
    } satisfies AccessTokenPayload,
    ACCESS_TOKEN_SECRET,
    {
      algorithm: jwtConstants.ALGORITHM,
      expiresIn: ACCESS_TOKEN_VALIDITY,
      audience: jwtConstants.AUDIENCE,
      issuer: jwtConstants.ISSUER,
    },
  );

type RefreshTokenPayload = { sub: string; ver: number };

const tokenClaimsSchema = z.object({ sub: z.uuid(), ver: z.int().nonnegative() });

/**
Reads the user id and the token version the token was issued with.
The version must match the user's current `token_version`, or the token is revoked.
*/
export const getTokenClaims = (
  payload: jwt.JwtPayload | string,
): { userId: string; tokenVersion: number } => {
  const claims = tokenClaimsSchema.safeParse(typeof payload === 'string' ? undefined : payload);
  if (!claims.success) {
    throw new jwt.JsonWebTokenError('Invalid token claims');
  }
  return { userId: claims.data.sub, tokenVersion: claims.data.ver };
};

export const generateRefreshToken = (user: User): string =>
  jwt.sign(
    { sub: user.user_id, ver: user.token_version } satisfies RefreshTokenPayload,
    REFRESH_TOKEN_SECRET,
    {
      algorithm: jwtConstants.ALGORITHM,
      expiresIn: REFRESH_TOKEN_VALIDITY,
      audience: jwtConstants.AUDIENCE,
      issuer: jwtConstants.ISSUER,
    },
  );

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
