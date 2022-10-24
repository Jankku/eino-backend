import express from 'express';
import * as books from '../services/booklist';
import * as movies from '../services/movielist';

const router = express.Router();

// Book routes
router.get('/books/search', books.search);
router.get('/books/book/:bookId', books.fetchOne);
router.post('/books/add', books.addOne);
router.put('/books/update/:bookId', books.updateOne);
router.delete('/books/delete/:bookId', books.deleteOne);

router.get('/books/all', books.fetchAll);
router.get('/books/completed', (req, res, next) =>
  books.fetchByStatus(req, res, 'completed', next)
);
router.get('/books/reading', (req, res, next) => books.fetchByStatus(req, res, 'reading', next));
router.get('/books/on-hold', (req, res, next) => books.fetchByStatus(req, res, 'on-hold', next));
router.get('/books/dropped', (req, res, next) => books.fetchByStatus(req, res, 'dropped', next));
router.get('/books/planned', (req, res, next) => books.fetchByStatus(req, res, 'planned', next));

// Movie routes
router.get('/movies/search', movies.search);
router.get('/movies/movie/:movieId', movies.fetchOne);
router.post('/movies/add', movies.addOne);
router.put('/movies/update/:movieId', movies.updateOne);
router.delete('/movies/delete/:movieId', movies.deleteOne);

router.get('/movies/all', movies.fetchAll);
router.get('/movies/completed', (req, res, next) =>
  movies.fetchByStatus(req, res, 'completed', next)
);
router.get('/movies/watching', (req, res, next) =>
  movies.fetchByStatus(req, res, 'watching', next)
);
router.get('/movies/on-hold', (req, res, next) => movies.fetchByStatus(req, res, 'on-hold', next));
router.get('/movies/dropped', (req, res, next) => movies.fetchByStatus(req, res, 'dropped', next));
router.get('/movies/planned', (req, res, next) => movies.fetchByStatus(req, res, 'planned', next));

export default router;
