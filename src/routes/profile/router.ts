import express from 'express';
import { validateSchema } from '../../middleware/validateschema.ts';
import {
  deleteAccount,
  generateShareImage,
  exportProfileData,
  importProfileData,
  getProfileV2,
  saveProfilePicture,
  deleteProfilePicture,
} from '../../services/profile.ts';
import {
  deleteAccountSchema,
  exportProfileSchema,
  generateShareImageSchema,
  importProfileSchema,
} from './schema.ts';
import { withProfilePictureUpload } from '../../middleware/profilepictureupload.ts';

export const profileRouterV2 = express.Router();

profileRouterV2.get('/', getProfileV2);
profileRouterV2.get('/share', validateSchema(generateShareImageSchema), generateShareImage);
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
