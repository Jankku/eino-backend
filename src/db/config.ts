import { config } from '../config';
import pgPromise, { IInitOptions } from 'pg-promise';
import monitor from 'pg-monitor';

const options: IInitOptions = {
  capSQL: true,
};

export const pgp = pgPromise(options);

export const db = pgp({
  connectionString: config.DATABASE_URL,
});

pgp.pg.types.setTypeParser(20, (value: string) => Number.parseInt(value)); // INT8
pgp.pg.types.setTypeParser(701, (value: string) => Number.parseFloat(value)); // FLOAT8
pgp.pg.types.setTypeParser(1700, (value: string) => Number.parseFloat(value)); // NUMERIC

if (process.env.NODE_ENV !== 'production') {
  monitor.attach(options);
}
