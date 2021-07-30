import { Pool, QueryConfig } from 'pg';
import Logger from '../util/logger';

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
});

pool.on('connect', () => Logger.info('Connected to pool'));
pool.on('error', (err: Error) => Logger.error(err.stack));

const query = async (q: QueryConfig) => {
  const client = await pool.connect();
  let res;
  try {
    await client.query('BEGIN');
    try {
      res = await client.query(q);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
  return res;
};

export {
  query,
  pool,
};
