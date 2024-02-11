import z from 'zod';
import errorMessages from '../../util/errormessages';

export const movieStatuses = ['completed', 'watching', 'on-hold', 'dropped', 'planned'] as const;

type MovieStatus = (typeof movieStatuses)[number];

export const movieStatusEnum = z.enum(movieStatuses, {
  invalid_type_error: errorMessages.LIST_STATUS_INVALID,
});

export const isMovieStatus = (status: string): status is MovieStatus =>
  movieStatuses.includes(status as MovieStatus);

export default MovieStatus;
