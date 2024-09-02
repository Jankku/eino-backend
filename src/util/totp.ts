import * as OTPAuth from 'otpauth';
import crypto from 'node:crypto';

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

const generateSecret = async () => {
  const rfc = await import('rfc4648');
  return rfc.base32.stringify(crypto.randomBytes(16));
};

const generateTOTP = async (config: Partial<TOTPConfigWithLabel>) => {
  const secret = await generateSecret();
  const defaults = {
    issuer: 'eino',
    algorithm: 'SHA1',
    digits: 6,
    period: 30, // 30 seconds
    secret: OTPAuth.Secret.fromBase32(secret),
  };
  const totp = new OTPAuth.TOTP({
    ...defaults,
    ...config,
  });
  const otp = totp.generate();
  return { otp, ...totp, secret: totp.secret.base32, totpUrl: totp.toString() };
};

const validateTOTP = (config: TOTPConfig) => {
  const totp = new OTPAuth.TOTP({
    ...config,
    secret: OTPAuth.Secret.fromBase32(config.secret),
    issuer: 'eino',
  });
  const delta = totp.validate({ token: config.otp, window: 1 });
  return delta !== null && [-1, 0, 1].includes(delta);
};

export { generateTOTP, validateTOTP };
