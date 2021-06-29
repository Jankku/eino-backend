import { Pool } from 'pg';

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const query = (q: any, params: any) => {
  pool.query(q, params);
};

export default query;
