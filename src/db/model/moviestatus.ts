export const movieStatuses = ['completed', 'watching', 'on-hold', 'dropped', 'planned'] as const;

type MovieStatus = typeof movieStatuses[number];

export const isMovieStatus = (status: string): status is MovieStatus =>
  movieStatuses.includes(status as MovieStatus);

export default MovieStatus;
