import type { ITask } from 'pg-promise';

type DbVerification = {
  id: string;
  user_id: string;
  type: 'email' | '2fa' | 'password_reset';
  target: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
  created_on: Date;
  expires_on?: Date;
};

type Verification = Omit<DbVerification, 'id' | 'created_on'> & { created_on?: Date };

type VerificationKey =
  | { userId: string; type: '2fa' }
  // Email codes are valid only for the address they were sent to.
  | { userId: string | undefined; type: 'email' | 'password_reset'; target: string };

export const addVerification = async (t: ITask<unknown>, v: Verification) => {
  await t.none({
    text: `INSERT INTO verifications (user_id, type, target, secret, algorithm, digits, period, expires_on, created_on)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP))`,
    values: [
      v.user_id,
      v.type,
      v.target,
      v.secret,
      v.algorithm,
      v.digits,
      v.period,
      v.expires_on,
      v.created_on,
    ],
  });
};

/**
Returns the newest verification. An undefined userId matches nothing, which lets
callers run the same query whether or not an account was found.
*/
export const findVerification = async (
  t: ITask<unknown>,
  key: VerificationKey,
): Promise<DbVerification | null> => {
  return await t.oneOrNone({
    text: `SELECT * FROM verifications
           WHERE user_id = $1 AND type = $2 AND ($3::text IS NULL OR target = $3)
           ORDER BY created_on DESC LIMIT 1`,
    values: [key.userId, key.type, 'target' in key ? key.target : undefined],
  });
};

export const deleteVerifications = async (
  t: ITask<unknown>,
  { userId, type }: { userId: string; type: DbVerification['type'] },
) => {
  await t.none({
    text: `DELETE FROM verifications WHERE user_id = $1 AND type = $2`,
    values: [userId, type],
  });
};
