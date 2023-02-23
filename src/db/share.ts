import { QueryConfig } from 'pg';
import { pool } from './config';
import DbShare from './model/dbshare';

type DbShareQueryResult = { rows: DbShare[] };

const getShare = async (id: string): Promise<DbShare> => {
  const getShareQuery: QueryConfig = {
    text: `SELECT * FROM shares
            WHERE share_id = $1;`,
    values: [id],
  };
  const { rows }: DbShareQueryResult = await pool.query(getShareQuery);
  return rows[0];
};

const getSharesByUsername = async (username: string): Promise<DbShare[]> => {
  const getShareQuery: QueryConfig = {
    text: `SELECT share_id, created_on FROM shares
            WHERE username = $1;`,
    values: [username],
  };
  const { rows }: DbShareQueryResult = await pool.query(getShareQuery);
  return rows;
};

const postShare = async (id: string, username: string): Promise<string> => {
  const postShareQuery: QueryConfig = {
    text: `INSERT INTO shares (share_id, username)
           VALUES ($1, $2)
           ON CONFLICT (username)
            DO UPDATE SET share_id = $1
           RETURNING share_id;`,
    values: [id, username],
  };
  const { rows }: DbShareQueryResult = await pool.query(postShareQuery);
  return rows[0].share_id;
};

export { getShare, getSharesByUsername, postShare };
