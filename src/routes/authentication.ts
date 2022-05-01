import express from 'express';
import { register, login, generateNewAccessToken } from '../services/authentication';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refreshtoken', generateNewAccessToken);

export default router;
