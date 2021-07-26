import { sign } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

const generateJwt = (userId: string, username: string): string => sign(
  { userId, username },
  `${process.env.JWT_SECRET}`,
  {
    expiresIn: '7d',
    audience: 'eino',
    issuer: 'eino-backend',
  },
);

const generatePasswordHash = (password: string): string => bcrypt.hashSync(password, 10);

export {
  generateJwt,
  generatePasswordHash,
};
