import express from 'express';
import * as books from '../services/booklist';
import * as movies from '../services/movielist';

const router = express.Router();

router.get('/books/completed', books.getCompletedList);
router.get('/books/reading', books.getReadingList);
router.get('/books/on-hold', books.getOnHoldList);
router.get('/books/dropped', books.getDroppedList);
router.get('/books/planned', books.getPlannedList);

router.get('/movies/completed', movies.getCompletedList);
router.get('/movies/watching', movies.getWatchingList);
router.get('/movies/on-hold', movies.getOnHoldList);
router.get('/movies/dropped', movies.getDroppedList);
router.get('/movies/planned', movies.getPlannedList);

export default router;
