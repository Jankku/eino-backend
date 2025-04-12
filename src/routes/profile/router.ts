import express from 'express';
import { validateSchema } from '../../middleware/validateschema';
import {
  deleteAccount,
  getProfile,
  generateShareImage,
  exportProfileData,
  importProfileData,
  getProfileV2,
  saveProfilePicture,
} from '../../services/profile';
import { deleteAccountSchema, exportProfileSchema, importProfileSchema } from './schema';
import multer from 'multer';

const upload = multer();

export const profileRouter = express.Router();

profileRouter.get('/', getProfile);
profileRouter.get('/share', generateShareImage);
profileRouter.post('/export', validateSchema(exportProfileSchema), exportProfileData);
profileRouter.post('/deleteaccount', validateSchema(deleteAccountSchema), deleteAccount);

export const profileRouterV2 = express.Router();

profileRouterV2.get('/', getProfileV2);
profileRouterV2.get('/share', generateShareImage);
profileRouterV2.post('/profilepicture', upload.single('picture'), saveProfilePicture);
profileRouterV2.post('/export', validateSchema(exportProfileSchema), exportProfileData);
profileRouterV2.post('/import', validateSchema(importProfileSchema), importProfileData);
profileRouterV2.post('/deleteaccount', validateSchema(deleteAccountSchema), deleteAccount);
