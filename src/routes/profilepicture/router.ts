import express from 'express';
import { validateSchema } from '../../middleware/validateschema.ts';
import { getProfilePictureSchema } from './schema.ts';
import { getProfilePicture } from '../../services/profilepicture.ts';

export const profilePictureRouter = express.Router();

profilePictureRouter.get('/:fileName', validateSchema(getProfilePictureSchema), getProfilePicture);
