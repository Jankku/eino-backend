import express from 'express';
import * as books from '../services/booklist';

const router = express.Router();

router.get('/:bookId', books.getBook);
router.post('/', books.addBookToList);
router.put('/:bookId', books.updateBook);
router.delete('/:bookId', books.deleteBook);

export default router;
