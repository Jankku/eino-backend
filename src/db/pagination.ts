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

const filterSql = ({ listQuery, stringKeys = [], dateKeys = [] }: PageOptions): string => {
  const [key, operator, value] = listQuery.filter ?? [];
  if (!key || !['=', '>', '<'].includes(operator)) return '';
  const column = pgp.as.name(key);
  if (stringKeys.includes(key)) {
    return pgp.as.format(`WHERE ${column}::text COLLATE "C" = $1`, [value]);
  }
  if (dateKeys.includes(key)) {
    if (value.length === 10) {
      return pgp.as.format(`WHERE (${column} AT TIME ZONE $1)::date ${operator} $2::date`, [
        DateTime.local().zoneName,
        value,
      ]);
    }
    return pgp.as.format(
      `WHERE date_trunc('milliseconds', ${column}) ${operator} $1::timestamptz`,
      [DateTime.fromISO(value, { zone: 'utc' }).toJSDate()],
    );
  }
  return pgp.as.format(`WHERE ${column} ${operator} $1`, [Number(value)]);
};

export const getPage = async <T>(
  t: ITask<unknown>,
  options: PageOptions,
): Promise<PaginatedResponse<T>> => {
  const { pagination, listQuery, idColumn, stringKeys = [], dateKeys = [] } = options;
  const source = pgp.as.format(options.query, options.values);
  const filtered = `FROM (${source}) AS items ${filterSql(options)}`;
  const column = pgp.as.name(listQuery.sort);
  let sort = column;
  if (stringKeys.includes(listQuery.sort)) {
    sort = `NULLIF(${column}::text, '') COLLATE eino_list_en`;
  } else if (dateKeys.includes(listQuery.sort)) {
    sort = `date_trunc('milliseconds', ${column})`;
  }
  const direction = listQuery.order === 'descending' ? 'DESC' : 'ASC';
  const limit = pgp.as.format('LIMIT $1 OFFSET $2', [
    pagination.pageSize,
    (pagination.page - 1) * pagination.pageSize,
  ]);
  const results = await t.any<T>(
    `SELECT * ${filtered}
     ORDER BY ${sort} ${direction} NULLS LAST, ${pgp.as.name(idColumn)} ASC
     ${limit}`,
  );
  const { total } = await t.one<{ total: number }>(`SELECT COUNT(*) AS total ${filtered}`);
  return {
    results,
    pagination: {
      ...pagination,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    },
  };
};
