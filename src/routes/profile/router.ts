import express from 'express';
import validateSchema from '../../middleware/validateschema';
import {
  deleteAccount,
  getProfile,
  generateShareImage,
  exportUserData,
  getProfileV2,
} from '../../services/profile';
import { deleteAccountSchema, getProfileSchema } from './schema';

export const profileRouter = express.Router();

profileRouter.get('/', getProfile);
profileRouter.get('/share', generateShareImage);
profileRouter.post('/export', validateSchema(getProfileSchema), exportUserData);
profileRouter.post('/deleteaccount', validateSchema(deleteAccountSchema), deleteAccount);

export const profileRouterV2 = express.Router();

profileRouterV2.get('/', getProfileV2);
profileRouterV2.get('/share', generateShareImage);
profileRouterV2.post('/export', validateSchema(getProfileSchema), exportUserData);
profileRouterV2.post('/deleteaccount', validateSchema(deleteAccountSchema), deleteAccount);
