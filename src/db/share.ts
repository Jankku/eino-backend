import type { ITask } from 'pg-promise';
import type { DbShare } from './model/dbshare.ts';

export const getShare = async (t: ITask<unknown>, id: string): Promise<DbShare> => {
  return await t.one({
    text: `SELECT share_id, user_id, created_on FROM shares
            WHERE share_id = $1;`,
    values: [id],
  });
};

export const getSharesByUserId = async (
  t: ITask<unknown>,
  userId: string,
): Promise<Omit<DbShare, 'user_id'>[]> => {
  return await t.any({
    text: `SELECT share_id, created_on FROM shares
            WHERE user_id = $1;`,
    values: [userId],
  });
};

export const createShare = async (
  t: ITask<unknown>,
  { id, userId }: { id: string; userId: string },
): Promise<string> => {
  const result = await t.one({
    text: `INSERT INTO shares (share_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id)
            DO UPDATE SET share_id = $1
           RETURNING share_id;`,
    values: [id, userId],
  });
  return result.share_id;
};
