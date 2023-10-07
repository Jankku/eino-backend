import express from 'express';
import validateSchema from '../../middleware/validateschema';
import * as auth from '../../services/auth';
import { registerSchema, loginSchema, refreshTokenSchema, passwordStrengthSchema } from './schema';

export const authRouter = express.Router();

authRouter.post('/register', validateSchema(registerSchema), auth.register);
authRouter.post('/login', validateSchema(loginSchema), auth.login);
authRouter.post('/refreshtoken', validateSchema(refreshTokenSchema), auth.generateNewAccessToken);
authRouter.post('/passwordstrength', validateSchema(passwordStrengthSchema), auth.passwordStrength);
