import express from 'express';
import * as movies from '../services/movielist';

const router = express.Router();

router.get('/:movieId', movies.getMovie);
router.post('/', movies.addMovieToList);
router.put('/:movieId', movies.updateMovie);
router.delete('/:movieId', movies.deleteMovie);

export default router;
