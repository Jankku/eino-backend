import express from 'express';
import validateSchema from '../../middleware/validateschema';
import * as books from '../../services/books';
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

router.get('/search', validateSchema(searchSchema), books.search);
router.get('/book/:bookId', validateSchema(fetchOneSchema), books.fetchOne);
router.post('/add', validateSchema(addOneSchema), books.addOne);
router.put('/update/:bookId', validateSchema(updateOneSchema), books.updateOne);
router.delete('/delete/:bookId', validateSchema(deleteOneSchema), books.deleteOne);
router.get('/images', validateSchema(fetchImagesSchema), books.fetchImages);

router.get('/all', books.fetchAll);
router.get('/:status', validateSchema(fetchByStatusSchema), books.fetchByStatus);

export default router;
