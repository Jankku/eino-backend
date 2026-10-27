import { ITask } from 'pg-promise';
import { DbShare } from './model/dbshare';

export const getShare = async (
  t: ITask<unknown>,
  id: string,
): Promise<DbShare & { user_id: string }> => {
  return await t.one({
    text: `SELECT shares.*, users.user_id FROM shares
            JOIN users ON users.username = shares.username
            WHERE shares.share_id = $1;`,
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
