import Pool from 'pg-pool';
import { PoolClient, QueryConfig, types } from 'pg';
import Logger from '../util/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

types.setTypeParser(types.builtins.INT8, (value: string) => parseInt(value));
types.setTypeParser(types.builtins.FLOAT8, (value: string) => parseFloat(value));
types.setTypeParser(types.builtins.NUMERIC, (value: string) => parseFloat(value));

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
