import { sign } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

const generateJwtToken = (userId: string, username: string): string => sign(
  { userId, username },
  `${process.env.JWT_SECRET}`,
  { expiresIn: '7d' },
);

const generatePasswordHash = (password: string): string => bcrypt.hashSync(password, 10);

export {
  generateJwtToken,
  generatePasswordHash,
};
