import express from 'express';
import validateSchema from '../../middleware/validateschema';
import { getShareImage } from '../../services/share';
import { getShareImageSchema } from './schema';

const router = express.Router();

router.get('/:id', validateSchema(getShareImageSchema), getShareImage);

export default router;
