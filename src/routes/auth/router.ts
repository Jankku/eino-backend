import express from 'express';
import validateSchema from '../../middleware/validateschema';
import { register, login, generateNewAccessToken } from '../../services/auth';
import { registerSchema, loginSchema, refreshTokenSchema } from './schema';

const router = express.Router();

router.post('/register', validateSchema(registerSchema), register);
router.post('/login', validateSchema(loginSchema), login);
router.post('/refreshtoken', validateSchema(refreshTokenSchema), generateNewAccessToken);

export default router;
