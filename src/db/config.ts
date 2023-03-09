import Pool from 'pg-pool';
import { PoolClient, QueryConfig, types } from 'pg';
import Logger from '../util/logger';
import config from '../config';

types.setTypeParser(types.builtins.INT8, (value: string) => parseInt(value));
types.setTypeParser(types.builtins.FLOAT8, (value: string) => parseFloat(value));
types.setTypeParser(types.builtins.NUMERIC, (value: string) => parseFloat(value));

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  idleTimeoutMillis: 10_000,
});

(async () => {
  const client = await pool.connect();
  Logger.info('Connected to database');
  client.release();
})();

pool.on('error', (error) => {
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
