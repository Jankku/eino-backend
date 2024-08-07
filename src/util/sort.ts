/* eslint-disable security/detect-object-injection */
import { DateTime } from 'luxon';
import { SortOrder } from '../model/zodschema';

const isDate = (value: unknown): value is Date => value instanceof Date;

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumber = (value: unknown): value is number => typeof value === 'number';

const stringSort = (a: string, b: string, order: SortOrder) => {
  return order === 'ascending' ? a.localeCompare(b) : b.localeCompare(a);
};

const numberSort = (a: number, b: number, order: SortOrder) => {
  return order === 'ascending' ? a - b : b - a;
};

const dateSort = (a: Date, b: Date, order: SortOrder) => {
  const startDate = DateTime.fromJSDate(a).toMillis();
  const endDate = DateTime.fromJSDate(b).toMillis();
  return order === 'ascending' ? startDate - endDate : endDate - startDate;
};

export const itemSorter = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  sort: string,
  order: SortOrder,
) => {
  if (isDate(a[sort]) && isDate(b[sort])) {
    return dateSort(a[sort], b[sort], order);
  } else if (isString(a[sort]) && isString(b[sort])) {
    return stringSort(a[sort], b[sort], order);
  } else if (isNumber(a[sort]) && isNumber(b[sort])) {
    return numberSort(a[sort], b[sort], order);
  } else {
    return 0;
  }
};
