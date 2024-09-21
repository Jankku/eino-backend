import express from 'express';
import validateSchema from '../../middleware/validateschema';
import { getProfilePictureSchema } from './schema';
import { getProfilePicture } from '../../services/profilepicture';

export const profilePictureRouter = express.Router();

profilePictureRouter.get('/:fileName', validateSchema(getProfilePictureSchema), getProfilePicture);
