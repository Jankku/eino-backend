import crypto from 'node:crypto';
import { ItemScoreRow } from '../db/profile';
import Book from '../db/model/book';
import Movie from '../db/model/movie';
import { pgp } from '../db/config';

/**
 * Fills array gaps so that there are ItemScoreRow objects which have score
 * from 1 to 10. Lastly it sorts the array by the score property.
 * @example
 * [
 *    { score: 1, count: 6 },
 *    { score: 2, count: 4 },
 *    { score: 3, count: 1 },
 *    { score: 4, count: 12 }
 *    ...
 * ]
 * @param array Initial book/movie score array
 */
const fillAndSortResponse = async (array: ItemScoreRow[]) =>
  new Promise<Array<ItemScoreRow>>((resolve) => {
    const resultArray: ItemScoreRow[] = [];
    const foundNumbers: number[] = [];

    for (const item of array) {
      resultArray.push(item);
      foundNumbers.push(item.score);
    }

    for (let i = 1; i <= 10; i++) {
      if (!foundNumbers.includes(i)) {
        resultArray.push({ score: i, count: 0 });
      }
    }

    resultArray.sort((a, b) => a.score - b.score);
    resolve(resultArray);
  });

const booksCs = new pgp.helpers.ColumnSet(
  ['isbn', 'title', 'author', 'publisher', 'image_url', 'pages', 'year', 'submitter'],
  { table: 'books' },
);

const booksListCs = new pgp.helpers.ColumnSet(
  ['book_id', 'username', 'status', 'score', 'start_date', 'end_date'],
  { table: 'user_book_list' },
);

const moviesCs = new pgp.helpers.ColumnSet(
  ['title', 'studio', 'director', 'writer', 'image_url', 'duration', 'year', 'submitter'],
  { table: 'movies' },
);

const moviesListCs = new pgp.helpers.ColumnSet(
  ['movie_id', 'username', 'status', 'score', 'start_date', 'end_date'],
  { table: 'user_movie_list' },
);

const calculateBookHash = (book: Book) => {
  const hash = `${book.isbn}${book.title}${book.author}${book.publisher}${book.image_url}${book.pages}${book.year}`;
  return crypto.createHash('md5').update(hash).digest('hex');
};

const calculateMovieHash = (movie: Movie) => {
  const hash = `${movie.title}${movie.studio}${movie.director}${movie.writer}${movie.image_url}${movie.duration}${movie.year}`;
  return crypto.createHash('md5').update(hash).digest('hex');
};

export {
  fillAndSortResponse,
  calculateBookHash,
  calculateMovieHash,
  booksCs,
  booksListCs,
  moviesCs,
  moviesListCs,
};
