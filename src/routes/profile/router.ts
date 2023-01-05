import express from 'express';
import validateSchema from '../../middleware/validateschema';
import { deleteAccount, getProfile, generateShareImage } from '../../services/profile';
import { deleteAccountSchema } from './schema';

const router = express.Router();

router.get('/', getProfile);
router.get('/share', generateShareImage);
router.post('/deleteaccount', validateSchema(deleteAccountSchema), deleteAccount);

export default router;
