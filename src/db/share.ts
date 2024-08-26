import { ITask } from 'pg-promise';
import { db } from './config';
import DbShare from './model/dbshare';

const getShare = async (id: string): Promise<DbShare> => {
  return await db.one({
    text: `SELECT * FROM shares
            WHERE share_id = $1;`,
    values: [id],
  });
};

const getSharesByUsername = async (
  username: string,
  client?: ITask<unknown>,
): Promise<DbShare[]> => {
  const c = client || db;
  return await c.any({
    text: `SELECT share_id, created_on FROM shares
            WHERE username = $1;`,
    values: [username],
  });
};

const createShare = async (id: string, username: string): Promise<string> => {
  const result = await db.one({
    text: `INSERT INTO shares (share_id, username)
           VALUES ($1, $2)
           ON CONFLICT (username)
            DO UPDATE SET share_id = $1
           RETURNING share_id;`,
    values: [id, username],
  });
  return result.share_id;
};

export { getShare, getSharesByUsername, createShare };
