import express from 'express';
import validateSchema from '../../middleware/validateschema';
import { getShareImage } from '../../services/share';
import { getShareImageSchema } from './schema';

export const shareRouter = express.Router();

shareRouter.get('/:id', validateSchema(getShareImageSchema), getShareImage);
