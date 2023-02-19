import express from 'express';
import validateSchema from '../../middleware/validateschema';
import * as movies from '../../services/movies';
import {
  addOneSchema,
  deleteOneSchema,
  fetchByStatusSchema,
  fetchImagesSchema,
  fetchOneSchema,
  searchSchema,
  updateOneSchema,
} from './schema';

const router = express.Router();

router.get('/search', validateSchema(searchSchema), movies.search);
router.get('/movie/:movieId', validateSchema(fetchOneSchema), movies.fetchOne);
router.post('/add', validateSchema(addOneSchema), movies.addOne);
router.put('/update/:movieId', validateSchema(updateOneSchema), movies.updateOne);
router.delete('/delete/:movieId', validateSchema(deleteOneSchema), movies.deleteOne);
router.get('/images', validateSchema(fetchImagesSchema), movies.fetchImages);

router.get('/all', movies.fetchAll);
router.get('/:status', validateSchema(fetchByStatusSchema), movies.fetchByStatus);

export default router;
