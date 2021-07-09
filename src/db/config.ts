import { Pool, QueryConfig } from 'pg';

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const query = (q: QueryConfig, params?: any) => pool.query(q, params);

export {
  query,
  pool,
};
