import { db } from './config';

type DbVerification = {
  id: string;
  type: 'email';
  target: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
  created_on: string;
  expires_on: string;
};

type Verification = Omit<DbVerification, 'id' | 'created_on' | 'expires_on'>;

const addVerification = async (v: Verification) => {
  await db.none({
    text: `INSERT INTO verifications (type, target, secret, algorithm, digits, period)
              VALUES ($1, $2, $3, $4, $5, $6)`,
    values: [v.type, v.target, v.secret, v.algorithm, v.digits, v.period],
  });
};

const getVerification = async (target: string): Promise<DbVerification> => {
  return await db.one({
    text: `SELECT * FROM verifications WHERE target = $1 ORDER by created_on DESC LIMIT 1`,
    values: [target],
  });
};

const deleteVerification = async (target: string) => {
  await db.none({
    text: `DELETE FROM verifications WHERE target = $1`,
    values: [target],
  });
};

export { addVerification, getVerification, deleteVerification };
