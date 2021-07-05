import express from 'express';
import * as books from '../services/booklist';

const router = express.Router();

router.get('/completed', books.getCompletedList);
router.get('/reading', books.getReadingList);
router.get('/on-hold', books.getOnHoldList);
router.get('/dropped', books.getDroppedList);
router.get('/planned', books.getPlannedList);

export default router;
