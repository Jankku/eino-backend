import express from 'express';
import validateSchema from '../../middleware/validateschema';
import { register, login, generateNewAccessToken } from '../../services/auth';
import { registerSchema, loginSchema, refreshTokenSchema } from './schema';

export const authRouter = express.Router();

authRouter.post('/register', validateSchema(registerSchema), register);
authRouter.post('/login', validateSchema(loginSchema), login);
authRouter.post('/refreshtoken', validateSchema(refreshTokenSchema), generateNewAccessToken);
