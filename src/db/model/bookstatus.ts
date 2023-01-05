export const bookStatuses = ['completed', 'reading', 'on-hold', 'dropped', 'planned'] as const;

type BookStatus = typeof bookStatuses[number];

export const isBookStatus = (status: string): status is BookStatus =>
  bookStatuses.includes(status as BookStatus);

export default BookStatus;
