/* eslint-disable security/detect-object-injection */
import { DateTime } from 'luxon';
import { SortOrder } from './zodschema';
import { z } from 'zod';

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value);

const collator = new Intl.Collator('en');
const stringSort = (a: string, b: string, order: SortOrder) => {
  return order === 'ascending' ? collator.compare(a, b) : collator.compare(b, a);
};

const numberSort = (a: number, b: number, order: SortOrder) => {
  return order === 'ascending' ? a - b : b - a;
};

const dateSort = (a: Date, b: Date, order: SortOrder) => {
  const startDate = DateTime.fromJSDate(a).toMillis();
  const endDate = DateTime.fromJSDate(b).toMillis();
  return order === 'ascending' ? startDate - endDate : endDate - startDate;
};

export const itemSorter = ({
  a,
  b,
  sort,
  order,
}: {
  a: Record<string, unknown>;
  b: Record<string, unknown>;
  sort: string;
  order: SortOrder;
}) => {
  if (isDate(a[sort]) && isDate(b[sort])) {
    return dateSort(a[sort], b[sort], order);
  }
  if (isString(a[sort]) && isString(b[sort])) {
    return stringSort(a[sort], b[sort], order);
  }
  return isNumber(a[sort]) && isNumber(b[sort]) ? numberSort(a[sort], b[sort], order) : 0;
};

const operatorSchema = z.enum(['=', '>', '<']);

const dateValue = (value: unknown): number | undefined => {
  if (isDate(value)) return value.getTime();
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10)) ||
    (value.length > 10 && value[10] !== 'T')
  )
    return;
  const date = DateTime.fromISO(value, { zone: 'utc' });
  return date.isValid ? date.toMillis() : undefined;
};

export const parseFilter = ({
  input,
  filterableKeySchema,
  stringKeySchema,
  numberKeySchema,
  dateKeySchema,
}: {
  input: string;
  filterableKeySchema: z.ZodType;
  stringKeySchema: z.ZodType;
  numberKeySchema: z.ZodType;
  dateKeySchema: z.ZodType;
}) => {
  // Input format: <key>:<operator>:<value>
  // Split only the separators: titles and ISO timestamps can contain colons.
  const firstSeparator = input.indexOf(':');
  const secondSeparator = input.indexOf(':', firstSeparator + 1);
  if (firstSeparator === -1 || secondSeparator === -1) return [];

  const key = input.slice(0, firstSeparator);
  const operator = input.slice(firstSeparator + 1, secondSeparator);
  const value = input.slice(secondSeparator + 1);

  if (
    !filterableKeySchema.safeParse(key).success ||
    !operatorSchema.safeParse(operator).success ||
    value.trim().length === 0
  ) {
    return [];
  }

  if (stringKeySchema.safeParse(key).success) {
    if (operator !== '=') return [];
  } else if (numberKeySchema.safeParse(key).success) {
    if (!Number.isFinite(Number(value))) return [];
  } else if (dateKeySchema.safeParse(key).success) {
    if (dateValue(value) === undefined) return [];
  } else {
    return [];
  }

  return [key, operator, value] as [string, z.infer<typeof operatorSchema>, string];
};

const compareNumbers = (actual: number, expected: number, operator: string): boolean => {
  switch (operator) {
    case '=': {
      return actual === expected;
    }
    case '>': {
      return actual > expected;
    }
    case '<': {
      return actual < expected;
    }
    default: {
      return false;
    }
  }
};

const itemNumberFilter = (item: Record<string, unknown>, filter: string[]) => {
  const [key, operator, value] = filter;
  const actual = item[key];
  const expected = Number(value);
  return (
    isNumber(actual) && Number.isFinite(expected) && compareNumbers(actual, expected, operator)
  );
};

const itemDateFilter = (item: Record<string, unknown>, filter: string[]) => {
  const [key, operator, value] = filter;
  const actualValue = item[key];
  // Date-only filters compare calendar days, including PostgreSQL DATE values
  // returned as local-midnight Dates. Timestamp filters compare exact instants.
  const actualDate = isDate(actualValue)
    ? DateTime.fromJSDate(actualValue)
    : typeof actualValue === 'string'
      ? DateTime.fromISO(actualValue)
      : undefined;
  const actual = dateValue(value.length === 10 ? actualDate?.toISODate() : actualValue);
  const expected = dateValue(value);
  return (
    actual !== undefined && expected !== undefined && compareNumbers(actual, expected, operator)
  );
};

const itemStringFilter = (item: Record<string, unknown>, filter: string[]) => {
  const [key, operator, value] = filter;
  return operator === '=' && item[key] === value;
};

export const getItemFilter = ({
  key,
  stringSchema,
  numberSchema,
  dateSchema,
}: {
  key: string;
  stringSchema: z.ZodType;
  numberSchema: z.ZodType;
  dateSchema: z.ZodType;
}) => {
  if (numberSchema.safeParse(key).success) return itemNumberFilter;
  if (dateSchema.safeParse(key).success) return itemDateFilter;
  if (stringSchema.safeParse(key).success) return itemStringFilter;
};
