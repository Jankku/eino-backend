import express from 'express';
import { validateSchema } from '../../middleware/validateschema.ts';
import {
  deleteAccount,
  getProfile,
  generateShareImage,
  exportProfileData,
  importProfileData,
  getProfileV2,
  saveProfilePicture,
  deleteProfilePicture,
} from '../../services/profile.ts';
import { deleteAccountSchema, exportProfileSchema, importProfileSchema } from './schema.ts';
import { withProfilePictureUpload } from '../../middleware/profilepictureupload.ts';

export const profileRouter = express.Router();

profileRouter.get('/', getProfile);
profileRouter.get('/share', generateShareImage);
profileRouter.post(
  '/export',
  validateSchema(exportProfileSchema, 'profile_export'),
  exportProfileData,
);
profileRouter.post(
  '/deleteaccount',
  validateSchema(deleteAccountSchema, 'account_delete'),
  deleteAccount,
);

export const profileRouterV2 = express.Router();

profileRouterV2.get('/', getProfileV2);
profileRouterV2.get('/share', generateShareImage);
profileRouterV2.post('/profilepicture', withProfilePictureUpload(saveProfilePicture));
profileRouterV2.delete('/profilepicture', deleteProfilePicture);
profileRouterV2.post(
  '/export',
  validateSchema(exportProfileSchema, 'profile_export'),
  exportProfileData,
);
profileRouterV2.post('/import', validateSchema(importProfileSchema), importProfileData);
profileRouterV2.post(
  '/deleteaccount',
  validateSchema(deleteAccountSchema, 'account_delete'),
  deleteAccount,
);
