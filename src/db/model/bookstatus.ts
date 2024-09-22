import z from 'zod';
import { errorMessages } from '../../util/errormessages';

export const bookStatuses = ['completed', 'reading', 'on-hold', 'dropped', 'planned'] as const;

export const bookStatusEnum = z.enum(bookStatuses, {
  invalid_type_error: errorMessages.LIST_STATUS_INVALID,
});

export type BookStatus = (typeof bookStatuses)[number];

export const isBookStatus = (status: string): status is BookStatus =>
  bookStatuses.includes(status as BookStatus);
