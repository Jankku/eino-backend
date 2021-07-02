import { Pool } from 'pg';

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sendQuery = (query: any, params: any) => pool.query(query, params);

export default sendQuery;
