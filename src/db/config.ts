import Pool from 'pg-pool';
import { QueryConfig } from 'pg';
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

export { query, pool };
