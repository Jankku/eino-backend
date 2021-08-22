import express from 'express';
import { register, login, refreshTokens } from '../services/authentication';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refreshtoken', refreshTokens);

export default router;
