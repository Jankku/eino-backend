import express from 'express';
import { getProfile } from '../services/profile';

const router = express.Router();

router.get('/', getProfile);

export default router;
