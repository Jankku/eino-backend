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

// Random, non-account credentials generated once with the production KDF settings.
const dummyArgon2Hash =
  '$argon2id$v=19$m=26624,t=2,p=1$Rc06xlhZZC+3oMMWqZuUfg$4nyyXiCak+maColc7nhoBuiCFlOnRiBKu8Vy7F0L/o8';
const dummyBcryptHash = '$2b$12$tgMVG8Eif718FU/rxL61cOW.b/PUhBlagBlreY9PS3PozvrxVCmbq';

export const verifyPassword = async (password: string, hash?: string): Promise<boolean> => {
  try {
    const bcryptHash = !!hash && isBcryptHash(hash);
    const argon2Hash = !!hash && hash.startsWith('$argon2id$');
    // Always run both KDFs, including for missing accounts, while legacy bcrypt
    // credentials are being migrated (legacy bcrypt cost: 12). Keep dummy costs
    // aligned with stored credentials. Dummy results must never authenticate.
    const bcryptMatches = await bcrypt.compare(password, bcryptHash ? hash : dummyBcryptHash);
    const argon2Matches = await argon2.verify(argon2Hash ? hash : dummyArgon2Hash, password);
    return (bcryptHash && bcryptMatches) || (argon2Hash && argon2Matches);
  } catch {
    throw new Error('Password verification failed');
  }
};

// bcrypt cannot authenticate the suffix at or beyond its 72-byte boundary.
// Those accounts need an explicit password reset to establish an Argon2 credential.
export const shouldUpgradePassword = (password: string, hash: string): boolean =>
  isBcryptHash(hash) && Buffer.byteLength(password, 'utf8') < 72;
