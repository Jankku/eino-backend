import express from 'express';
import { deleteAccount, getProfile, generateShareImage } from '../services/profile';

const router = express.Router();

router.get('/', getProfile);
router.get('/share', generateShareImage);
router.post('/deleteaccount', deleteAccount);

export default router;
