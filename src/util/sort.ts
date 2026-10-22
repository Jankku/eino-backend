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

const operatorSchema = z.union([z.literal('='), z.literal('>'), z.literal('<')]);

export const parseFilter = ({
  input,
  filterableKeySchema,
  stringKeySchema,
  numberKeySchema,
}: {
  input: string;
  filterableKeySchema: z.ZodType;
  stringKeySchema: z.ZodType;
  numberKeySchema: z.ZodType;
}) => {
  const match = input.split(':'); // <key>:<operator>:<value>

  if (match.length !== 3) return [];

  const [key, operator, value] = match;

  if (!filterableKeySchema.safeParse(key).success || !operatorSchema.safeParse(operator).success)
    return [];

  if (numberKeySchema.safeParse(key).success && Number.isNaN(Number.parseInt(value))) {
    return [];
  }

  return (stringKeySchema.safeParse(key).success && Number.isSafeInteger(Number.parseInt(value))) ||
    value.length === 0
    ? []
    : ([key, operator, value] as [string, z.infer<typeof operatorSchema>, string]);
};

const itemNumberFilter = (item: Record<string, never>, filter: string[]) => {
  const [key, operator, value] = filter;
  switch (operator) {
    case '=': {
      return item[key] === Number.parseInt(value);
    }
    case '>': {
      return item[key] > Number.parseInt(value);
    }
    case '<': {
      return item[key] < Number.parseInt(value);
    }
  }
};

const itemStringFilter = (item: Record<string, never>, filter: string[]) => {
  const [key, operator, value] = filter;
  switch (operator) {
    case '=': {
      return item[key] === value;
    }
  }
};

export const getItemFilter = ({
  key,
  stringSchema,
  numberSchema,
}: {
  key: string;
  stringSchema: z.ZodType;
  numberSchema: z.ZodType;
}) => {
  return numberSchema.safeParse(key).success
    ? itemNumberFilter
    : stringSchema.safeParse(key).success
      ? itemStringFilter
      : undefined;
};
