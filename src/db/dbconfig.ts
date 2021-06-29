import { Client } from 'pg';

require('dotenv').config();

const client = new Client({
  user: `${process.env.PGUSER}`,
  host: `${process.env.PGHOST}`,
  database: `${process.env.PGDATABASE}`,
  password: `${process.env.PGPASSWORD}`,
  port: parseInt(`${process.env.PGPORT}`, 10),
});

client.connect();

function query(q: any, params: any) {
  client.query(q, params);
}

export default query;
