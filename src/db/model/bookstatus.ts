import { z } from 'zod';
import { errorMessages } from '../../util/errormessages.ts';

export const bookStatuses = ['completed', 'reading', 'on-hold', 'dropped', 'planned'] as const;

export const bookStatusEnum = z.enum(bookStatuses, {
  error: errorMessages.LIST_STATUS_INVALID,
});

export type BookStatus = (typeof bookStatuses)[number];
