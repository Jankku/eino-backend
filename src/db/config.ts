import { Pool, QueryConfig } from 'pg';
import Logger from '../util/logger';

require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('connect', () => Logger.info('Connected to pool'));
pool.on('error', (err: Error) => Logger.error(err.stack));

const query = (q: QueryConfig, params?: any) => pool.query(q, params);

export {
  query,
  pool,
};
