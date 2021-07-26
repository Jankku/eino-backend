import express from 'express';
import * as books from '../services/booklist';
import * as movies from '../services/movielist';

const router = express.Router();

// Book routes
router.get('/books/book/:bookId', books.getBookById);
router.post('/books/add', books.addBookToList);
router.put('/books/edit/:bookId', books.updateBook);
router.delete('/books/delete/:bookId', books.deleteBook);

router.get('/books/completed', books.getCompletedList);
router.get('/books/reading', books.getReadingList);
router.get('/books/on-hold', books.getOnHoldList);
router.get('/books/dropped', books.getDroppedList);
router.get('/books/planned', books.getPlannedList);

// Movie routes
router.get('/movies/movie/:movieId', movies.getMovie);
router.post('/movies/add', movies.addMovieToList);
router.put('/movies/edit/:movieId', movies.updateMovie);
router.delete('/movies/delete/:movieId', movies.deleteMovie);

router.get('/movies/completed', movies.getCompletedList);
router.get('/movies/watching', movies.getWatchingList);
router.get('/movies/on-hold', movies.getOnHoldList);
router.get('/movies/dropped', movies.getDroppedList);
router.get('/movies/planned', movies.getPlannedList);

export default router;
