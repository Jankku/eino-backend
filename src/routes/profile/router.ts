import express from 'express';
import validateSchema from '../../middleware/validateschema';
import {
  deleteAccount,
  getProfile,
  generateShareImage,
  exportUserData,
} from '../../services/profile';
import { deleteAccountSchema, getProfileSchema } from './schema';

const router = express.Router();

router.get('/', getProfile);
router.get('/share', generateShareImage);
router.post('/export', validateSchema(getProfileSchema), exportUserData);
router.post('/deleteaccount', validateSchema(deleteAccountSchema), deleteAccount);

export default router;
