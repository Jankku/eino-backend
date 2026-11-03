import { bookStatuses } from '../db/model/bookstatus.ts';
import { movieStatuses } from '../db/model/moviestatus.ts';

export type StatusCountRow = {
  status: string;
  count: number;
};

export const fillBookStatuses = (rows: StatusCountRow[]): StatusCountRow[] => {
  return bookStatuses.map((status) => {
    const row = rows.find((row) => row.status === status);
    return { status, count: row?.count || 0 };
  });
};

export const fillMovieStatuses = (rows: StatusCountRow[]): StatusCountRow[] => {
  return movieStatuses.map((status) => {
    const row = rows.find((row) => row.status === status);
    return { status, count: row?.count || 0 };
  });
};
