import { Pool, QueryConfig } from 'pg';
import Logger from '../util/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
});

pool.on('error', (error: Error) => Logger.error(error.stack));

const query = async (q: QueryConfig) => {
  const client = await pool.connect();
  let res;
  try {
    await client.query('BEGIN');
    try {
      res = await client.query(q);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }
  return res;
};

export { query, pool };
