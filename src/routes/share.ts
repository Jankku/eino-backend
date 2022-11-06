import express from 'express';
import { getShareImage } from '../services/share';

const router = express.Router();

router.get('/:id', getShareImage);

export default router;
