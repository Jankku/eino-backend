import { timingSafeEqual } from 'node:crypto';
import * as OTPAuth from 'otpauth';

type TOTPConfig = {
  otp: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
};

type TOTPConfigWithLabel = TOTPConfig & {
  label: string;
};

const TOTP_ISSUER = 'Eino';

export const generateTOTP = (config: Partial<TOTPConfigWithLabel>) => {
  const defaults = {
    issuer: TOTP_ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30, // 30 seconds
    secret: new OTPAuth.Secret({ size: 20 }),
  } satisfies Partial<OTPAuth.TOTP>;
  const totp = new OTPAuth.TOTP({
    ...defaults,
    ...config,
  });
  const created_on = new Date();
  const otp = totp.generate({ timestamp: created_on.getTime() });
  return { otp, ...totp, secret: totp.secret.base32, totpUrl: totp.toString(), created_on };
};

// Used only to perform equivalent OTP work when a reset record is absent.
export const dummyEmailVerification = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  created_on: new Date(0),
};

const validateOTP = (config: TOTPConfig, timestamp: number, window: number) => {
  const totp = new OTPAuth.TOTP({
    ...config,
    secret: OTPAuth.Secret.fromBase32(config.secret),
    issuer: TOTP_ISSUER,
  });
  // Length and format depend only on caller input, never on a secret prefix.
  if (config.otp.length !== config.digits || !/^\d+$/.test(config.otp)) return false;
  const token = Buffer.from(config.otp);
  let matches = 0;
  // Check every accepted time step, even after a match.
  for (let offset = -window; offset <= window; offset++) {
    const expected = totp.generate({ timestamp: timestamp + offset * config.period * 1000 });
    matches |= Number(timingSafeEqual(token, Buffer.from(expected)));
  }
  return matches !== 0;
};

export const validateEmailOTP = (config: TOTPConfig & { created_on: Date }) =>
  validateOTP(config, config.created_on.getTime(), 0);

export const validateTOTP = (config: TOTPConfig) => validateOTP(config, Date.now(), 1);
