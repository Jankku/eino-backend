import { ITask } from 'pg-promise';
import { DateTime } from 'luxon';
import { pgp } from './config';
import { ListQuery, PaginatedResponse, Pagination } from '../util/pagination';

export const paginationMode = new pgp.txMode.TransactionMode({
  tiLevel: pgp.txMode.isolationLevel.repeatableRead,
  readOnly: true,
});

type PageOptions = {
  query: string;
  values?: unknown[];
  pagination: Pagination;
  idColumn: string;
  listQuery: ListQuery;
  stringKeys?: readonly string[];
  dateKeys?: readonly string[];
};

const dateFilterSql = (column: string, operator: string, value: string): string => {
  if (value.length === 10) {
    return pgp.as.format(`WHERE (${column} AT TIME ZONE $1)::date ${operator} $2::date`, [
      DateTime.local().zoneName,
      value,
    ]);
  }

  return pgp.as.format(`WHERE date_trunc('milliseconds', ${column}) ${operator} $1::timestamptz`, [
    DateTime.fromISO(value, { zone: 'utc' }).toJSDate(),
  ]);
};

const filterSql = ({
  listQuery: { filter },
  stringKeys = [],
  dateKeys = [],
}: PageOptions): string => {
  if (!filter) return '';
  const [key, operator, value] = filter;
  if (!key || !['=', '>', '<'].includes(operator)) return '';

  const column = pgp.as.name(key);
  if (stringKeys.includes(key)) {
    return pgp.as.format(`WHERE ${column}::text COLLATE "C" = $1`, [value]);
  }
  if (dateKeys.includes(key)) {
    return dateFilterSql(column, operator, value);
  }
  return pgp.as.format(`WHERE ${column} ${operator} $1`, [Number(value)]);
};

const sortColumnSql = ({
  listQuery: { sort },
  stringKeys = [],
  dateKeys = [],
}: PageOptions): string => {
  const column = pgp.as.name(sort);
  if (stringKeys.includes(sort)) {
    return `NULLIF(${column}::text, '') COLLATE eino_list_en`;
  }
  if (dateKeys.includes(sort)) return `date_trunc('milliseconds', ${column})`;
  return column;
};

const orderBySql = (options: PageOptions): string => {
  const { listQuery, idColumn } = options;
  const direction = listQuery.order === 'descending' ? 'DESC' : 'ASC';
  return `ORDER BY ${sortColumnSql(options)} ${direction} NULLS LAST, ${pgp.as.name(idColumn)} ASC`;
};

export const getPage = async <T>(
  t: ITask<unknown>,
  options: PageOptions,
): Promise<PaginatedResponse<T>> => {
  const { query, values, pagination } = options;
  const { page, pageSize } = pagination;
  const source = pgp.as.format(query, values);
  const filteredSource = `FROM (${source}) AS items ${filterSql(options)}`;
  const limit = pgp.as.format('LIMIT $1 OFFSET $2', [pageSize, (page - 1) * pageSize]);

  const results = await t.any<T>(`SELECT * ${filteredSource} ${orderBySql(options)} ${limit}`);
  const { total } = await t.one<{ total: number }>(`SELECT COUNT(*) AS total ${filteredSource}`);

  return {
    results,
    pagination: {
      ...pagination,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};
