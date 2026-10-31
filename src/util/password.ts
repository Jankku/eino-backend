import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 26_624, // 26 MB
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} satisfies argon2.HashOptions;

const isBcryptHash = (hash: string): boolean => /^\$2[ab]\$/.test(hash);

export const generatePasswordHash = (password: string): Promise<string> =>
  argon2.hash(password, argon2Options);

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    if (isBcryptHash(hash)) return await bcrypt.compare(password, hash);
    return hash.startsWith('$argon2id$') ? await argon2.verify(hash, password) : false;
  } catch {
    throw new Error('Password verification failed');
  }
};

// bcrypt cannot authenticate the suffix at or beyond its 72-byte boundary.
// Those accounts need an explicit password reset to establish an Argon2 credential.
export const shouldUpgradePassword = (password: string, hash: string): boolean =>
  isBcryptHash(hash) && Buffer.byteLength(password, 'utf8') < 72;
