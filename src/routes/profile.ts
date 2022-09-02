import express from 'express';
import { deleteAccount, getProfile } from '../services/profile';

const router = express.Router();

router.get('/', getProfile);
router.post('/deleteaccount', deleteAccount);

export default router;
