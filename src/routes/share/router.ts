import express from 'express';
import { validateSchema } from '../../middleware/validateschema.ts';
import { getShareImage } from '../../services/share.ts';
import { getShareImageSchema } from './schema.ts';

export const shareRouter = express.Router();

shareRouter.get('/:id', validateSchema(getShareImageSchema), getShareImage);
