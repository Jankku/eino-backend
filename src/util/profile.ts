import crypto from 'node:crypto';
import type { Book } from '../db/model/book.ts';
import type { Movie } from '../db/model/movie.ts';
import { pgp } from '../db/config.ts';

export const booksCs = new pgp.helpers.ColumnSet(
  [
    'isbn',
    'title',
    'author',
    'publisher',
    'image_url',
    'pages',
    'year',
    'language_code',
    'user_id',
  ],
  { table: 'books' },
);

export const booksListCs = new pgp.helpers.ColumnSet(
  ['book_id', 'status', 'score', 'note', 'start_date', 'end_date'],
  { table: 'user_book_list' },
);

export const moviesCs = new pgp.helpers.ColumnSet(
  ['title', 'studio', 'director', 'writer', 'image_url', 'duration', 'year', 'user_id'],
  { table: 'movies' },
);

export const moviesListCs = new pgp.helpers.ColumnSet(
  ['movie_id', 'status', 'score', 'note', 'start_date', 'end_date'],
  { table: 'user_movie_list' },
);

export const calculateBookHash = (book: Book) => {
  const hash = `${book.isbn}${book.title}${book.author}${book.publisher}${book.image_url}${book.pages}${book.year}`;
  return crypto.createHash('md5').update(hash).digest('hex');
};

export const calculateMovieHash = (movie: Movie) => {
  const hash = `${movie.title}${movie.studio}${movie.director}${movie.writer}${movie.image_url}${movie.duration}${movie.year}`;
  return crypto.createHash('md5').update(hash).digest('hex');
};
