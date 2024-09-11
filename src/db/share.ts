import { ITask } from 'pg-promise';
import DbShare from './model/dbshare';

export const getShare = async (t: ITask<unknown>, id: string): Promise<DbShare> => {
  return await t.one({
    text: `SELECT * FROM shares
            WHERE share_id = $1;`,
    values: [id],
  });
};

export const getSharesByUsername = async (
  t: ITask<unknown>,
  username: string,
): Promise<DbShare[]> => {
  return await t.any({
    text: `SELECT share_id, created_on FROM shares
            WHERE username = $1;`,
    values: [username],
  });
};

export const createShare = async (
  t: ITask<unknown>,
  { id, username }: { id: string; username: string },
): Promise<string> => {
  const result = await t.one({
    text: `INSERT INTO shares (share_id, username)
           VALUES ($1, $2)
           ON CONFLICT (username)
            DO UPDATE SET share_id = $1
           RETURNING share_id;`,
    values: [id, username],
  });
  return result.share_id;
};
