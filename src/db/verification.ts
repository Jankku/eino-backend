import { ITask } from 'pg-promise';

type DbVerification = {
  id: string;
  type: 'email' | '2fa' | 'password_reset';
  target: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
  created_on: Date;
  expires_on?: Date;
};

type Verification = Omit<DbVerification, 'id' | 'created_on'>;

export const addVerification = async (t: ITask<unknown>, v: Verification) => {
  await t.none({
    text: `INSERT INTO verifications (type, target, secret, algorithm, digits, period, expires_on)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    values: [v.type, v.target, v.secret, v.algorithm, v.digits, v.period, v.expires_on],
  });
};

export const getVerification = async (
  t: ITask<unknown>,
  {
    target,
    type,
  }: {
    target: string;
    type: DbVerification['type'];
  },
): Promise<DbVerification> => {
  return await t.one({
    text: `SELECT * FROM verifications WHERE target = $1 AND type = $2 ORDER by created_on DESC LIMIT 1`,
    values: [target, type],
  });
};

export const findVerification = async (
  t: ITask<unknown>,
  {
    target,
    type,
  }: {
    target: string;
    type: DbVerification['type'];
  },
): Promise<DbVerification | null> => {
  return await t.oneOrNone({
    text: `SELECT * FROM verifications WHERE target = $1 AND type = $2 ORDER by created_on DESC LIMIT 1`,
    values: [target, type],
  });
};

export const deleteVerification = async (
  t: ITask<unknown>,
  {
    target,
    type,
  }: {
    target: string;
    type: DbVerification['type'];
  },
) => {
  await t.none({
    text: `DELETE FROM verifications WHERE target = $1 AND type = $2`,
    values: [target, type],
  });
};
