import Pool from 'pg-pool';
import { PoolClient, QueryConfig } from 'pg';
import Logger from '../util/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
});

pool.on('error', (error: Error) => {
  Logger.error(error.stack);
});

const query = (q: QueryConfig) => pool.query(q);

const transaction = async (callback: (client: PoolClient) => Promise<void>) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await callback(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export { query, transaction, pool };
