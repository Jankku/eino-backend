import express from 'express';
import * as movies from '../services/movielist';

const router = express.Router();

router.get('/completed', movies.getCompletedList);
router.get('/watching', movies.getWatchingList);
router.get('/on-hold', movies.getOnHoldList);
router.get('/dropped', movies.getDroppedList);
router.get('/planned', movies.getPlannedList);

router.post('/', movies.addMovieToList);

router.get('/:movieId', movies.getMovie);
router.put('/:movieId', movies.updateMovie);
router.delete('/:movieId', movies.deleteMovie);

export default router;
